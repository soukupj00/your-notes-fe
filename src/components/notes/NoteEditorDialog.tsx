import { Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type EditorHandle } from '@/components/editor/editor.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { db } from '@/db/db.ts';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { bodyHasAttachment, extractAttachmentIds } from '@/lib/attachment-html.ts';
import { stripHtml } from '@/lib/utils.ts';

const AUTOSAVE_DELAY_MS = 600;

/** TipTap HTML for a checklist that opens with one empty item ready to type. */
export const EMPTY_CHECKLIST_BODY =
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>';

type SaveStatus = 'idle' | 'saving' | 'saved';

// A note is "empty" (nothing worth persisting) when both its header and its
// stripped body are blank. Module-scoped: it closes over no component state, so
// keeping it out of the component keeps the autosave callbacks stable.
const isEmpty = (header: string, body: string) =>
  header.trim() === '' && stripHtml(body).trim() === '' && !bodyHasAttachment(body);

type NoteEditorDialogProps = {
  /** Existing note id, or null for a new (draft) note not yet persisted. */
  noteId: string | null;
  /** Seed body for a new draft (e.g. an empty checklist for quick-capture). */
  initialBody?: string;
  /** Best-effort: autoplay the note's first audio attachment on open (set when
   *  the note was opened via its card's audio chip). */
  autoplayFirstAudio?: boolean;
  onClose: () => void;
};

/**
 * The single edit surface: a responsive Dialog (full-screen on mobile, centered
 * on desktop). The parent keys this by note id so it remounts per note; state is
 * therefore initialised fresh each open. Autosave is local-state driven, never
 * fed from a live query, so typing never resets the cursor (guardrail 1). New
 * notes are held as a draft and only persisted on first meaningful change
 * (guardrail 2); a note left empty on close is discarded.
 */
export function NoteEditorDialog({
  noteId,
  initialBody,
  autoplayFirstAudio,
  onClose,
}: NoteEditorDialogProps) {
  const { t } = useTranslation();
  const { createNote, updateNote, deleteNote } = useNoteActions();
  const { collectOrphans } = useAttachmentActions();

  const [header, setHeader] = useState('');
  // New drafts may seed a body (e.g. checklist); existing notes load below.
  const [body, setBody] = useState(noteId ? '' : (initialBody ?? ''));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // A checklist draft opens focused in the body so the first item is ready.
  const focusBody = !noteId && !!initialBody;

  const editorRef = useRef<EditorHandle>(null);

  // The id we persist to: the prop for an existing note, or null until a draft
  // is first saved. A ref (not state) so serialized saves see it synchronously.
  const idRef = useRef<string | null>(noteId);
  // Mirrors of header/body for ensureNoteId, so its identity stays stable
  // across keystrokes (it's read by the Image extension's deps, and a new
  // identity there would mint a new imageDeps object on every render).
  const headerRef = useRef(header);
  headerRef.current = header;
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize saves so a draft is created exactly once, then updated.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Load an existing note's content once on mount (not via a live query).
  useEffect(() => {
    if (!noteId) return;
    let active = true;
    db.notes.get(noteId).then((n) => {
      if (active && n) {
        setHeader(n.header ?? '');
        setBody(n.body ?? '');
      }
    });
    return () => {
      active = false;
    };
  }, [noteId]);

  const persist = useCallback(
    async (h: string, b: string) => {
      if (idRef.current == null) {
        if (isEmpty(h, b)) return;
        const created = await createNote({ header: h, body: b });
        idRef.current = created.id;
      } else {
        await updateNote(idRef.current, { header: h, body: b });
      }
    },
    [createNote, updateNote]
  );

  // Attachments need a persisted note to reference. When an image is inserted
  // into a not-yet-saved draft, create the note now (an image is meaningful
  // content) and return its id; existing notes just return their id. The
  // create is chained onto the SAME saveChainRef queue persist() uses, so a
  // concurrent autosave/close cannot also create the draft: whichever runs
  // first creates and sets idRef, the other sees it set (exactly-once create).
  const ensureNoteId = useCallback(async (): Promise<string> => {
    const chained = saveChainRef.current.then(async () => {
      if (idRef.current == null) {
        const created = await createNote({ header: headerRef.current, body: bodyRef.current });
        idRef.current = created.id;
      }
      return idRef.current as string;
    });
    // Advance the queue, swallowing errors so it is never left rejected.
    saveChainRef.current = chained.then(
      () => undefined,
      () => undefined
    );
    return chained;
  }, [createNote]);

  const enqueueSave = useCallback(
    (h: string, b: string) => {
      saveChainRef.current = saveChainRef.current.then(() => persist(h, b));
      return saveChainRef.current;
    },
    [persist]
  );

  // Debounced autosave whenever the user has actually edited something.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Skip the status flicker when there's nothing to persist (empty draft).
      if (idRef.current == null && isEmpty(header, body)) return;
      setSaveStatus('saving');
      enqueueSave(header, body).then(() => setSaveStatus('saved'));
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [header, body, enqueueSave]);

  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await enqueueSave(header, body); // flush the latest edit
    // Discard a note that ended up empty (covers a draft typed then cleared).
    if (idRef.current != null && isEmpty(header, body)) {
      await deleteNote(idRef.current); // cascade-deletes its attachments (Task 4)
      idRef.current = null;
    } else if (idRef.current != null) {
      // Reclaim attachment rows no longer referenced by the saved Body. Safe now:
      // the in-editor undo stack is gone once the dialog closes.
      await collectOrphans(idRef.current, extractAttachmentIds(body));
    }
    onClose();
  }, [enqueueSave, header, body, deleteNote, collectOrphans, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void handleClose();
      }}
    >
      <DialogContent
        // Clicking the dialog's own padding/gaps (not a child element) drops the
        // cursor into the body, so tapping the margins feels editable too.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            editorRef.current?.focus();
          }
        }}
        className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-3 overflow-y-auto rounded-none border-0 sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border"
      >
        <DialogTitle className="sr-only">
          {noteId ? t('notes.editNoteTitle') : t('notes.newNoteTitle')}
        </DialogTitle>

        {/* Quiet local autosave indicator (icon only), tucked left of the close
            button. M5 can extend this to Syncing/Offline states. */}
        {saveStatus !== 'idle' && (
          <div
            aria-live="polite"
            className="absolute top-4 right-12 flex items-center text-muted-foreground"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            <span className="sr-only">{t(`notes.saveStatus.${saveStatus}`)}</span>
          </div>
        )}

        <input
          value={header}
          onChange={(e) => {
            dirtyRef.current = true;
            setHeader(e.target.value);
          }}
          placeholder={t('notes.titlePlaceholder')}
          aria-label={t('notes.titlePlaceholder')}
          className="w-full bg-transparent font-semibold text-foreground text-xl outline-none placeholder:text-muted-foreground"
        />

        <Editor
          ref={editorRef}
          content={body}
          editable
          getNoteId={ensureNoteId}
          autoFocus={focusBody}
          autoplayFirstAudio={autoplayFirstAudio}
          stickyToolbarOnMobile
          // Mobile: no bordered box, so the dialog's own padding is the only
          // spacing around the title + content. Desktop keeps the framed editor.
          className="flex-1 rounded-none border-0 p-0 sm:rounded-xl sm:border sm:p-4"
          onUpdate={(html) => {
            dirtyRef.current = true;
            setBody(html);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
