import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor } from '@/components/editor/editor.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { db } from '@/db/db.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { stripHtml } from '@/lib/utils.ts';

const AUTOSAVE_DELAY_MS = 600;

// A note is "empty" (nothing worth persisting) when both its header and its
// stripped body are blank. Module-scoped: it closes over no component state, so
// keeping it out of the component keeps the autosave callbacks stable.
const isEmpty = (header: string, body: string) =>
  header.trim() === '' && stripHtml(body).trim() === '';

type NoteEditorDialogProps = {
  /** Existing note id, or null for a new (draft) note not yet persisted. */
  noteId: string | null;
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
export function NoteEditorDialog({ noteId, onClose }: NoteEditorDialogProps) {
  const { t } = useTranslation();
  const { createNote, updateNote, deleteNote } = useNoteActions();

  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');

  // The id we persist to: the prop for an existing note, or null until a draft
  // is first saved. A ref (not state) so serialized saves see it synchronously.
  const idRef = useRef<string | null>(noteId);
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
    timerRef.current = setTimeout(() => enqueueSave(header, body), AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [header, body, enqueueSave]);

  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await enqueueSave(header, body); // flush the latest edit
    // Discard a note that ended up empty (covers a draft typed then cleared).
    if (idRef.current != null && isEmpty(header, body)) {
      await deleteNote(idRef.current);
      idRef.current = null;
    }
    onClose();
  }, [enqueueSave, header, body, deleteNote, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void handleClose();
      }}
    >
      <DialogContent className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-3 overflow-y-auto rounded-none border-0 sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border">
        <DialogTitle className="sr-only">
          {noteId ? t('notes.editNoteTitle') : t('notes.newNoteTitle')}
        </DialogTitle>

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
          content={body}
          editable
          onUpdate={(html) => {
            dirtyRef.current = true;
            setBody(html);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
