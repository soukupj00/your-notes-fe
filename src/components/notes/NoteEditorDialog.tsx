import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type EditorHandle } from '@/components/editor/editor.tsx';
import { NoteEditorBar } from '@/components/notes/NoteEditorBar.tsx';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/noteDrafts.ts';
import { useNoteReminder } from '@/components/notes/useNoteReminder.ts';
import { AppBar } from '@/components/ui/AppBar.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useIsMobile } from '@/hooks/use-mobile.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { useKeyboardInset } from '@/hooks/useKeyboardInset.ts';
import { bodyHasAttachment, extractAttachmentIds } from '@/lib/body.ts';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';
import type { Intent } from '@/lib/intent.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { requestPersistentStorage } from '@/lib/persistentStorage.ts';
import { type Reminder, reminderOf } from '@/lib/reminder.ts';
import { stripHtml } from '@/lib/utils.ts';
import type { NoteState } from '@/models.ts';

const AUTOSAVE_DELAY_MS = 600;

type SaveStatus = 'idle' | 'saving' | 'saved';

const isEmpty = (header: string, body: string) =>
  header.trim() === '' && stripHtml(body).trim() === '' && !bodyHasAttachment(body);

/** Decoration only: the announcement is the one live region in the dialog. */
function SaveStatusIcon({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return status === 'saving' ? (
    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
  ) : (
    <Check className="size-4 text-muted-foreground" aria-hidden />
  );
}

type NoteEditorDialogProps = {
  /** Existing note id, or null for a new (draft) note not yet persisted. */
  noteId: string | null;
  /**
   * The id a draft takes when first persisted, minted at open so the URL can name
   * the note before its row exists (ADR 0014). Ignored when `noteId` is set.
   */
  draftId?: string;
  /** `noteId` names no stored note (a dead `?note=`); fixing the URL is the caller's job. */
  onNoteMissing?: () => void;
  /** What the Editor does as it opens, beyond showing the Note (CONTEXT.md "Intent"). */
  intent?: Intent;
  onClose: () => void;
};

/**
 * The single edit surface, keyed by note id so every open starts fresh. Autosave runs off
 * local state, never a live query, so typing never resets the cursor. A draft is persisted
 * on its first real change and discarded if it closes empty.
 */
export function NoteEditorDialog({
  noteId,
  draftId,
  intent,
  onClose,
  onNoteMissing,
}: NoteEditorDialogProps) {
  const { t } = useTranslation();
  const store = useLocalStore();
  const { createNote, updateNote, purgeNote, pinNote, unpinNote } = useNoteActions();
  const { collectOrphans } = useAttachmentActions();
  const isMobile = useIsMobile();
  const finePointer = useFinePointer();
  // The sheet is the one surface the software keyboard shares the screen with,
  // so it is the one that has to know how much of it the keyboard is covering.
  useKeyboardInset();

  const [header, setHeader] = useState('');
  // A checklist draft opens seeded with one item and focused in the body, so that item is ready.
  const checklistDraft = !noteId && intent?.kind === 'checklist';
  const [body, setBody] = useState(checklistDraft ? EMPTY_CHECKLIST_BODY : '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Note-bar fields are written through on each tap, not debounced like header and body:
  // a colour or a pin is one deliberate tap, not a stream of keystrokes.
  const [color, setColor] = useState<string | undefined>(undefined);
  const [pinnedAt, setPinnedAt] = useState<string | undefined>(undefined);
  const [state, setState] = useState<NoteState>('active');
  const [reminder, setReminder] = useState<Reminder | undefined>(undefined);

  const focusBody = checklistDraft;

  const editorRef = useRef<EditorHandle>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  // Radix hands focus back only to a `DialogTrigger`, and this dialog opens from
  // the URL with none, so it remembers what had focus (a Card's open button).
  const openerRef = useRef<HTMLElement | null>(null);

  // Null until a draft is first saved. A ref, not state, so serialized saves see it at once.
  const idRef = useRef<string | null>(noteId);
  // Mirrors of header/body so ensureNoteId keeps one identity across keystrokes:
  // the Image extension depends on it, and a new identity remints its deps every render.
  const headerRef = useRef(header);
  const bodyRef = useRef(body);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize saves so a draft is created exactly once, then updated.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Synced after commit is enough: ensureNoteId only reads them from later async work.
  useEffect(() => {
    headerRef.current = header;
    bodyRef.current = body;
  }, [header, body]);

  // Load an existing note's content once on mount (not via a live query).
  useAsyncEffect(
    async (alive) => {
      if (!noteId) return;
      const n = await store.notes.get(noteId);
      if (!alive()) return;
      if (n) {
        setHeader(n.header ?? '');
        setBody(n.body ?? '');
        setColor(n.color);
        setReminder(reminderOf(n));
        setPinnedAt(n.pinnedAt);
        setState(n.state);
        return;
      }
      // Not a blank editor: typing into it would silently recreate the note under the dead id.
      onNoteMissing?.();
    },
    [noteId, onNoteMissing, store]
  );

  const persist = useCallback(
    async (h: string, b: string) => {
      if (idRef.current == null) {
        if (isEmpty(h, b)) return;
        const created = await createNote({ id: draftId, header: h, body: b });
        idRef.current = created.id;
      } else {
        await updateNote(idRef.current, { header: h, body: b });
      }
      // The user's first own writing is when persistent storage is worth a prompt.
      // Only the dirty-gated save path reaches here, so a Tour's Props never trigger it.
      void requestPersistentStorage();
    },
    [createNote, updateNote, draftId]
  );

  // Attachments, labels and reminders need a persisted id, so this creates the draft if needed.
  // It rides the same queue as persist(), so a concurrent autosave cannot create it twice.
  const ensureNoteId = useCallback(async (): Promise<string> => {
    const chained = saveChainRef.current.then(async () => {
      if (idRef.current == null) {
        const created = await createNote({
          id: draftId,
          header: headerRef.current,
          body: bodyRef.current,
        });
        idRef.current = created.id;
      }
      return idRef.current as string;
    });
    // Swallow errors so one failed create does not leave the queue rejected for every later save.
    saveChainRef.current = chained.then(
      () => undefined,
      () => undefined
    );
    return chained;
  }, [createNote, draftId]);

  const { handleReminderSet, handleReminderClear } = useNoteReminder(
    ensureNoteId,
    headerRef,
    bodyRef,
    setReminder
  );

  const enqueueSave = useCallback(
    (h: string, b: string) => {
      saveChainRef.current = saveChainRef.current.then(() => persist(h, b));
      return saveChainRef.current;
    },
    [persist]
  );

  // Local state is set before the write so the tint and the pin answer on the tap.
  // A draft that was only coloured is still empty, so closing discards it.
  const handleColorChange = useCallback(
    async (next?: string) => {
      setColor(next);
      const id = await ensureNoteId();
      await updateNote(id, { color: next });
    },
    [ensureNoteId, updateNote]
  );

  const handlePinToggle = useCallback(async () => {
    const next = pinnedAt ? undefined : new Date().toISOString();
    setPinnedAt(next);
    const id = await ensureNoteId();
    // The lifecycle transitions own the pin field (ADR 0009) rather than a raw
    // updateNote, so the editor and the card write it the same way.
    if (next) await pinNote(id);
    else await unpinNote(id);
  }, [pinnedAt, ensureNoteId, pinNote, unpinNote]);

  // dirtyRef keeps the initial load from counting as an edit.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Skip the status flicker when there's nothing to persist (empty draft).
      if (idRef.current == null && isEmpty(header, body)) return;
      setSaveStatus('saving');
      void enqueueSave(header, body).then(() => setSaveStatus('saved'));
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [header, body, enqueueSave]);

  // On mobile this goes inside the editor as its footer, so the sticky format toolbar can sit
  // below it at the sheet's bottom edge. On desktop it stays a sibling under the framed editor.
  // Width decides, not pointer: it is a question of which box exists (ADR 0016).
  const noteBar = (
    <NoteEditorBar
      noteId={noteId}
      ensureNoteId={ensureNoteId}
      color={color}
      pinned={Boolean(pinnedAt)}
      pinnable={state === 'active'}
      shareable={state !== 'trashed'}
      onColorChange={(next) => void handleColorChange(next)}
      onPinToggle={() => void handlePinToggle()}
      reminder={reminder}
      onReminderSet={handleReminderSet}
      onReminderClear={() => void handleReminderClear()}
    />
  );

  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await enqueueSave(header, body);
    // An empty note is purged unless it has a Reminder: the calendar already holds
    // an event linking to its id.
    if (idRef.current != null && isEmpty(header, body) && !reminder) {
      await purgeNote(idRef.current);
      idRef.current = null;
    } else if (idRef.current != null) {
      // Safe only now: the in-editor undo stack that could restore a reference is gone.
      await collectOrphans(idRef.current, extractAttachmentIds(body));
    }
    onClose();
  }, [enqueueSave, header, body, reminder, purgeNote, collectOrphans, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void handleClose();
      }}
    >
      <DialogContent
        // The dialog wears the note's colour, or picking one would visibly change nothing.
        // `bg-note-surface!`: the vendored `bg-background` would otherwise win on stylesheet order.
        {...noteColorAttrs(color)}
        // Radix would focus the back arrow; the title gets it instead. Not for an existing note on
        // a Coarse pointer (the keyboard would cover a note opened to read), and not for a
        // checklist draft, whose editor autofocuses its first item.
        onOpenAutoFocus={(event) => {
          if (document.activeElement instanceof HTMLElement) {
            openerRef.current = document.activeElement;
          }
          event.preventDefault();
          if (focusBody) return;
          if (noteId && !finePointer) return;
          headerInputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus({ preventScroll: true });
        }}
        // Clicking the dialog's own padding/gaps (not a child element) drops the
        // cursor into the body, so tapping the margins feels editable too.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            editorRef.current?.focus();
          }
        }}
        // Below `sm:` the vendored X is hidden with a descendant selector (it is not a direct
        // child), and there is deliberately no bottom padding: the sticky toolbar owns that edge.
        // Both traps: src/components/editor/CLAUDE.md, "The editor sheet".
        className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-3 overflow-y-auto rounded-none border-0 bg-note-surface! pt-[calc(0.5rem+var(--safe-top))] pr-[calc(1rem+var(--safe-right))] pb-0 pl-[calc(1rem+var(--safe-left))] sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-card sm:border sm:border-note-border sm:p-6 [&_[data-slot=dialog-close]]:hidden sm:[&_[data-slot=dialog-close]]:flex"
      >
        <DialogTitle className="sr-only">
          {noteId ? t('notes.editNoteTitle') : t('notes.newNoteTitle')}
        </DialogTitle>

        {/* One always-mounted live region for both breakpoints: a region only announces changes
            made after it mounted, and a second one would announce everything twice. */}
        <div aria-live="polite" className="sr-only">
          {saveStatus !== 'idle' && t(`notes.saveStatus.${saveStatus}`)}
        </div>

        {/* Mobile closes with Back top-left, where a thumb reaches; the far-corner X reads as
            discard. Desktop keeps the vendored X, which suits a centred modal. */}
        <AppBar
          // `shrink-0` is load-bearing: once the editor overflows, the column flex would
          // otherwise crush this bar to zero height, leaving a focusable 0x0 arrow.
          className="-ml-3.5 shrink-0 px-0 py-0 sm:hidden"
          left={
            // Not `DialogClose asChild`: it would forward `data-slot="dialog-close"`, and the
            // rule hiding the vendored X on mobile would hide this arrow too.
            <Button
              variant="ghost"
              size="icon"
              className={CHROME_ICON_BUTTON}
              aria-label={t('nav.back')}
              onClick={() => void handleClose()}
            >
              <ArrowLeft />
            </Button>
          }
          right={<SaveStatusIcon status={saveStatus} />}
        />

        <div className="absolute top-4 right-14 hidden size-8 items-center justify-center text-muted-foreground sm:flex">
          <SaveStatusIcon status={saveStatus} />
        </div>

        <input
          ref={headerInputRef}
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
          intent={intent}
          stickyToolbarOnMobile
          footer={isMobile ? noteBar : undefined}
          className="flex-1 rounded-none border-0 p-0 sm:rounded-card sm:border sm:border-note-border sm:px-4"
          onUpdate={(html) => {
            dirtyRef.current = true;
            setBody(html);
          }}
        />

        {!isMobile && noteBar}
      </DialogContent>
    </Dialog>
  );
}
