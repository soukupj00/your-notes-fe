import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type EditorHandle } from '@/components/editor/editor.tsx';
import { NoteEditorBar } from '@/components/notes/NoteEditorBar.tsx';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/noteDrafts.ts';
import { TrashedNoteBar } from '@/components/notes/TrashedNoteBar.tsx';
import { useNoteReminder } from '@/components/notes/useNoteReminder.ts';
import { AppBar } from '@/components/ui/AppBar.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useIsMobile } from '@/hooks/use-mobile.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { useKeyboardAffordances } from '@/hooks/useKeyboardAffordances.ts';
import { useKeyboardInset } from '@/hooks/useKeyboardInset.ts';
import { useLatest } from '@/hooks/useLatest.ts';
import { useUndoableLifecycle } from '@/hooks/useUndoableLifecycle.ts';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';
import { createNoteDraft, isEmpty } from '@/lib/draft.ts';
import type { Intent } from '@/lib/intent.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { type Reminder, reminderOf } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';
import type { NoteState } from '@/models.ts';

const AUTOSAVE_DELAY_MS = 600;
const HEADER_CLASS = 'w-full font-semibold text-foreground text-xl';

type SaveStatus = 'idle' | 'saving' | 'saved';

/** Decoration only: the announcement is the one live region in the dialog. Sync arrows, not a
 *  tick: beside the close X a tick read as "confirm", as if the X would discard. */
function SaveStatusIcon({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();
  if (status === 'idle') return null;
  return (
    <IconTooltip
      label={t(status === 'saving' ? 'notes.saveStatus.saving' : 'notes.saveStatus.savedHint')}
    >
      <span className="flex">
        <RefreshCw
          className={cn('size-4 text-muted-foreground', status === 'saving' && 'animate-spin')}
          aria-hidden
        />
      </span>
    </IconTooltip>
  );
}

type NoteEditorDialogProps = {
  /** The Note's id, the URL's from the moment the editor opens (ADR 0014). */
  noteId: string;
  /** A Start's Draft, with no row yet; the default is a Note that already exists. */
  isNew?: boolean;
  /** `noteId` names no stored note (a dead `?note=`); fixing the URL is the caller's job. */
  onNoteMissing?: () => void;
  /** What the Editor does as it opens, beyond showing the Note (CONTEXT.md "Intent"). */
  intent?: Intent;
  onClose: () => void;
};

/**
 * The single edit surface, keyed by note id so every open starts fresh. Autosave runs off
 * local state, never a live query, so typing never resets the cursor. The Draft (`lib/draft.ts`)
 * owns the row: earned on the first real change, discarded if the Note closes empty.
 */
export function NoteEditorDialog({
  noteId,
  isNew = false,
  intent,
  onClose,
  onNoteMissing,
}: NoteEditorDialogProps) {
  const { t } = useTranslation();
  const store = useLocalStore();
  const { createNote, updateNote, purgeNote, pinNote, unpinNote } = useNoteActions();
  const { collectOrphans } = useAttachmentActions();
  const lifecycle = useUndoableLifecycle();
  const isMobile = useIsMobile();
  const keyboard = useKeyboardAffordances();
  // The sheet is the one surface the software keyboard shares the screen with,
  // so it is the one that has to know how much of it the keyboard is covering.
  useKeyboardInset();

  const [header, setHeader] = useState('');
  // A checklist draft opens seeded with one item and focused in the body, so that item is ready.
  const checklistDraft = isNew && intent?.kind === 'checklist';
  const [body, setBody] = useState(checklistDraft ? EMPTY_CHECKLIST_BODY : '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Note-bar fields are written through on each tap, not debounced like header and body:
  // a colour or a pin is one deliberate tap, not a stream of keystrokes.
  const [color, setColor] = useState<string | undefined>(undefined);
  const [pinnedAt, setPinnedAt] = useState<string | undefined>(undefined);
  const [state, setState] = useState<NoteState>('active');
  const [reminder, setReminder] = useState<Reminder | undefined>(undefined);
  const [loaded, setLoaded] = useState(isNew);

  const focusBody = checklistDraft;

  const editorRef = useRef<EditorHandle>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  // Radix hands focus back only to a `DialogTrigger`, and this dialog opens from
  // the URL with none, so it remembers what had focus (a Card's open button).
  const openerRef = useRef<HTMLElement | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What is typed so far, for an act that needs the row before the autosave ran and for a
  // Reminder's calendar event.
  const content = useLatest({ header, body });
  // Built once for the open: one Draft, one write queue, so a concurrent act and autosave on a
  // new Draft create its row exactly once.
  const [draft] = useState(() =>
    createNoteDraft(
      { id: noteId, isNew },
      { content, createNote, updateNote, purgeNote, collectOrphans }
    )
  );

  // Load an existing note's content once on mount (not via a live query).
  useAsyncEffect(
    async (alive) => {
      if (isNew) return;
      const n = await store.notes.get(noteId);
      if (!alive()) return;
      if (n) {
        setHeader(n.header ?? '');
        setBody(n.body ?? '');
        setColor(n.color);
        setReminder(reminderOf(n));
        setPinnedAt(n.pinnedAt);
        setState(n.state);
        setLoaded(true);
        return;
      }
      // Not a blank editor: typing into it would silently recreate the note under the dead id.
      onNoteMissing?.();
    },
    [noteId, isNew, onNoteMissing, store]
  );

  const { handleReminderSet, handleReminderClear } = useNoteReminder(draft, content, setReminder);

  // Local state is set before the write so the tint and the pin answer on the tap.
  // A draft that was only coloured is still empty, so closing discards it.
  const handleColorChange = useCallback(
    async (next?: string) => {
      setColor(next);
      const id = await draft.ensureSaved();
      await updateNote(id, { color: next });
    },
    [draft, updateNote]
  );

  const handlePinToggle = useCallback(async () => {
    const next = pinnedAt ? undefined : new Date().toISOString();
    setPinnedAt(next);
    const id = await draft.ensureSaved();
    // The lifecycle transitions own the pin field (ADR 0009) rather than a raw
    // updateNote, so the editor and the card write it the same way.
    if (next) await pinNote(id);
    else await unpinNote(id);
  }, [pinnedAt, draft, pinNote, unpinNote]);

  // dirtyRef keeps the initial load from counting as an edit.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Skip the status flicker when there's nothing to persist (empty draft).
      if (!draft.saved && isEmpty(header, body)) return;
      setSaveStatus('saving');
      void draft.save(header, body).then(() => setSaveStatus('saved'));
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [header, body, draft]);

  // In the trash a Note is a read-only preview: it cannot be edited, so closing it
  // writes nothing, which also keeps an empty one from being purged.
  const preview = state === 'trashed';

  const closeDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Before the load the fields are blank, not the Note's content, and an empty close purges.
    if (preview || !loaded) return;
    // An empty note is kept only for a Reminder: the calendar already holds an event linking
    // to its id.
    await draft.close(header, body, {
      keepEmpty: reminder !== undefined,
      edited: dirtyRef.current,
    });
  }, [preview, loaded, draft, header, body, reminder]);

  const handleClose = useCallback(async () => {
    await closeDraft();
    onClose();
  }, [closeDraft, onClose]);

  // The last save lands before the move, so its undo returns the Note as it was left. A Draft
  // that closed empty has no row to move, which makes this a plain close.
  // Released only on failure: a second press before the dialog unmounts would move it twice.
  const leavingRef = useRef(false);
  async function leaveWith(move: (id: string) => Promise<void>) {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      await closeDraft();
      if (draft.saved) await move(noteId);
      onClose();
    } catch (error) {
      leavingRef.current = false;
      throw error;
    }
  }

  // On mobile this goes inside the editor as its footer, so the sticky format toolbar can sit
  // below it at the sheet's bottom edge. On desktop it stays a sibling under the framed editor.
  // Width decides, not pointer: it is a question of which box exists (ADR 0016).
  // None before the load: `state` is only a default until then, and the edit bar's moves would
  // act on a trashed Note.
  const noteBar = !loaded ? null : preview ? (
    <TrashedNoteBar
      noteId={noteId}
      onRestore={() => void leaveWith(lifecycle.restore)}
      onArchive={() => void leaveWith(lifecycle.archive)}
      onDeleted={onClose}
    />
  ) : (
    <NoteEditorBar
      draft={draft}
      color={color}
      pinned={Boolean(pinnedAt)}
      state={state}
      onColorChange={(next) => void handleColorChange(next)}
      onPinToggle={() => void handlePinToggle()}
      onArchive={() => void leaveWith(lifecycle.archive)}
      onRestore={() => void leaveWith(lifecycle.restore)}
      onTrash={() => void leaveWith(lifecycle.trash)}
      reminder={reminder}
      onReminderSet={handleReminderSet}
      onReminderClear={() => void handleReminderClear()}
    />
  );

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
        // Radix would focus the back arrow; the title gets it instead. Not for an existing note
        // without a hardware keyboard (the software one would cover a note opened to read), and
        // not for a checklist draft, whose editor autofocuses its first item.
        onOpenAutoFocus={(event) => {
          if (document.activeElement instanceof HTMLElement) {
            openerRef.current = document.activeElement;
          }
          event.preventDefault();
          if (focusBody) return;
          if (!isNew && !keyboard) return;
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
          {isNew ? t('notes.newNoteTitle') : t('notes.editNoteTitle')}
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

        {preview ? (
          header && (
            <h2 dir="auto" className={cn(HEADER_CLASS, 'break-words')}>
              {header}
            </h2>
          )
        ) : (
          <input
            ref={headerInputRef}
            value={header}
            onChange={(e) => {
              dirtyRef.current = true;
              setHeader(e.target.value);
            }}
            // Not mid-composition: Safari reports the Enter that commits an IME word as key 229.
            onKeyDown={(e) => {
              if (
                e.key !== 'Enter' ||
                e.shiftKey ||
                e.nativeEvent.isComposing ||
                e.keyCode === 229
              ) {
                return;
              }
              e.preventDefault();
              editorRef.current?.focus('start');
            }}
            placeholder={t('notes.titlePlaceholder')}
            aria-label={t('notes.titlePlaceholder')}
            className={cn(
              HEADER_CLASS,
              'bg-transparent outline-none placeholder:text-muted-foreground'
            )}
          />
        )}

        <Editor
          // Remounted, not toggled: the Editor reads its content once, at creation.
          key={preview ? 'preview' : 'edit'}
          ref={editorRef}
          content={body}
          editable={!preview}
          getNoteId={draft.ensureSaved}
          autoFocus={focusBody}
          intent={intent}
          stickyToolbarOnMobile
          footer={isMobile ? noteBar : undefined}
          // A preview drops the frame, which would read as a field to type in.
          className={cn(
            'flex-1 rounded-none border-0 p-0',
            !preview && 'sm:rounded-card sm:border sm:border-note-border sm:px-4'
          )}
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
