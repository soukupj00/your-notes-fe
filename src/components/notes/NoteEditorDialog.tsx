import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaptureKind } from '@/components/editor/editor.tsx';
import { Editor, type EditorHandle } from '@/components/editor/editor.tsx';
import { NoteEditorBar } from '@/components/notes/NoteEditorBar.tsx';
import { AppBar } from '@/components/ui/AppBar.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { db } from '@/db/db.ts';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useIsMobile } from '@/hooks/use-mobile.tsx';
import { useKeyboardInset } from '@/hooks/useKeyboardInset.ts';
import { bodyHasAttachment, extractAttachmentIds } from '@/lib/attachment-html.ts';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { requestPersistentStorage } from '@/lib/persistentStorage.ts';
import { stripHtml } from '@/lib/utils.ts';
import type { NoteState } from '@/models.ts';

const AUTOSAVE_DELAY_MS = 600;

type SaveStatus = 'idle' | 'saving' | 'saved';

// A note is "empty" (nothing worth persisting) when both its header and its
// stripped body are blank. Module-scoped: it closes over no component state, so
// keeping it out of the component keeps the autosave callbacks stable.
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
   * The id a draft will take when it is first persisted, minted at open so the
   * URL can name the note before there is a row for it (ADR 0014). Ignored when
   * `noteId` is set. Optional so a caller outside a feed can still open an
   * editor without knowing about the URL.
   */
  draftId?: string;
  /**
   * `noteId` named a note that is not in the database - a dead `?note=` from a
   * discarded draft, a stale tab, or a shared link to something since deleted.
   * The dialog cannot decide what to do about the URL, so it reports up.
   */
  onNoteMissing?: () => void;
  /** Seed body for a new draft (e.g. an empty checklist for quick-capture). */
  initialBody?: string;
  /** Best-effort: autoplay the note's first audio attachment on open (set when
   *  the note was opened via its card's audio chip). */
  autoplayFirstAudio?: boolean;
  /** Capture to start as soon as the editor is ready (from the speed-dial). */
  initialCapture?: CaptureKind;
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
  draftId,
  initialBody,
  autoplayFirstAudio,
  initialCapture,
  onClose,
  onNoteMissing,
}: NoteEditorDialogProps) {
  const { t } = useTranslation();
  const { createNote, updateNote, purgeNote, pinNote, unpinNote } = useNoteActions();
  const { collectOrphans } = useAttachmentActions();
  const isMobile = useIsMobile();
  // The sheet is the one surface the software keyboard shares the screen with,
  // so it is the one that has to know how much of it the keyboard is covering.
  useKeyboardInset();

  const [header, setHeader] = useState('');
  // New drafts may seed a body (e.g. checklist); existing notes load below.
  const [body, setBody] = useState(noteId ? '' : (initialBody ?? ''));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // The note-bar fields. Held locally and written through immediately (unlike
  // header/body, which are debounced): a colour or a pin is one deliberate tap,
  // not a stream of keystrokes. A draft starts uncoloured, unpinned and Active.
  const [color, setColor] = useState<string | undefined>(undefined);
  const [pinnedAt, setPinnedAt] = useState<string | undefined>(undefined);
  const [state, setState] = useState<NoteState>('active');

  // A checklist draft opens focused in the body so the first item is ready.
  const focusBody = !noteId && !!initialBody;

  const editorRef = useRef<EditorHandle>(null);
  // The title field, so the dialog can hand it the opening focus. See
  // `onOpenAutoFocus` below - the app bar's back arrow now precedes it.
  const headerInputRef = useRef<HTMLInputElement>(null);

  // The id we persist to: the prop for an existing note, or null until a draft
  // is first saved. A ref (not state) so serialized saves see it synchronously.
  const idRef = useRef<string | null>(noteId);
  // Mirrors of header/body for ensureNoteId, so its identity stays stable
  // across keystrokes (it's read by the Image extension's deps, and a new
  // identity there would mint a new imageDeps object on every render).
  const headerRef = useRef(header);
  const bodyRef = useRef(body);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize saves so a draft is created exactly once, then updated.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Keep the mirrors current after each commit. ensureNoteId only reads them
  // from async work (an attachment insert, a label), which is always later.
  useEffect(() => {
    headerRef.current = header;
    bodyRef.current = body;
  }, [header, body]);

  // Load an existing note's content once on mount (not via a live query).
  useEffect(() => {
    if (!noteId) return;
    let active = true;
    void db.notes.get(noteId).then((n) => {
      if (!active) return;
      if (n) {
        setHeader(n.header ?? '');
        setBody(n.body ?? '');
        setColor(n.color);
        setPinnedAt(n.pinnedAt);
        setState(n.state);
        return;
      }
      // The note named by the URL is not there. Reporting up rather than
      // rendering an empty editor: a blank surface titled "edit note" invites
      // typing into a note that no longer exists, and on close would silently
      // create a second one under the dead id.
      onNoteMissing?.();
    });
    return () => {
      active = false;
    };
  }, [noteId, onNoteMissing]);

  const persist = useCallback(
    async (h: string, b: string) => {
      if (idRef.current == null) {
        if (isEmpty(h, b)) return;
        const created = await createNote({ id: draftId, header: h, body: b });
        idRef.current = created.id;
      } else {
        await updateNote(idRef.current, { header: h, body: b });
      }
      // The user has now written something of their own, which is the moment
      // this origin's storage is worth a permission prompt. Only the dirty-gated
      // save path reaches here, so a Tour's Props never trigger it.
      void requestPersistentStorage();
    },
    [createNote, updateNote, draftId]
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
        const created = await createNote({
          id: draftId,
          header: headerRef.current,
          body: bodyRef.current,
        });
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
  }, [createNote, draftId]);

  const enqueueSave = useCallback(
    (h: string, b: string) => {
      saveChainRef.current = saveChainRef.current.then(() => persist(h, b));
      return saveChainRef.current;
    },
    [persist]
  );

  // Colour and pin on a not-yet-saved draft go through the same ensureNoteId
  // queue labels and attachments use, so a draft is still created exactly once
  // whichever control the user reaches for first. Local state is set up front so
  // the tint and the pin respond on the tap rather than on the write; an empty
  // draft that was only coloured is still `isEmpty`, so closing discards it.
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

  // Debounced autosave whenever the user has actually edited something.
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

  /**
   * The note bar: labels, colour and pin, in the scroll flow rather than pinned
   * - the format toolbar is the only chrome that has to stay above the keyboard.
   *
   * One element, rendered in one of two places, because the two breakpoints have
   * genuinely different boxes to put it in. On mobile it goes *through* the
   * editor as its `footer`, so the sticky toolbar can sit below it and reach the
   * bottom of the sheet. On desktop the editor root is a bordered card and the
   * toolbar is at the top, so a footer would move this bar inside that frame -
   * it stays a sibling underneath it, exactly where it has always been.
   *
   * Width, not pointer: this is a question about which box exists (ADR 0016).
   */
  const noteBar = (
    <NoteEditorBar
      noteId={noteId}
      ensureNoteId={ensureNoteId}
      color={color}
      pinned={Boolean(pinnedAt)}
      pinnable={state === 'active'}
      onColorChange={(next) => void handleColorChange(next)}
      onPinToggle={() => void handlePinToggle()}
    />
  );

  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await enqueueSave(header, body); // flush the latest edit
    // Discard a note that ended up empty (covers a draft typed then cleared).
    if (idRef.current != null && isEmpty(header, body)) {
      await purgeNote(idRef.current); // cascade-deletes its attachments (Task 4)
      idRef.current = null;
    } else if (idRef.current != null) {
      // Reclaim attachment rows no longer referenced by the saved Body. Safe now:
      // the in-editor undo stack is gone once the dialog closes.
      await collectOrphans(idRef.current, extractAttachmentIds(body));
    }
    onClose();
  }, [enqueueSave, header, body, purgeNote, collectOrphans, onClose]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) void handleClose();
      }}
    >
      <DialogContent
        // The dialog is the note's own card held open, so it takes the note's
        // identity: a parchment tint by day, near-black with the identity edge
        // by night. That is also what makes the colour picker honest - without
        // it, choosing a colour changes nothing but a checkmark in the grid.
        // `bg-note-surface!` because the vendored DialogContent carries its own
        // `bg-background`, and between two background utilities the winner is
        // decided by stylesheet order, not by class order.
        {...noteColorAttrs(color)}
        // Radix gives the opening focus to the first focusable child, which is
        // now the app bar's back arrow: opening a note would put the caret on
        // "leave" rather than in the note. Redirect it to the title. A checklist
        // draft is left alone - `Editor autoFocus` puts the caret in the first
        // item, and this must not race it back up to the title.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (!focusBody) headerInputRef.current?.focus();
        }}
        // Clicking the dialog's own padding/gaps (not a child element) drops the
        // cursor into the body, so tapping the margins feels editable too.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            editorRef.current?.focus();
          }
        }}
        // The vendored close X is hidden below `sm:` rather than switched off
        // with `showCloseButton`, because that prop is a boolean and this needs
        // to be a breakpoint: mobile closes from the app bar's back arrow,
        // desktop keeps the X. Hiding it beats re-vendoring the button, whose
        // themed styling and 44px inset overlay we would otherwise duplicate.
        // Descendant (`_`), not child (`>`): the close is written as a direct
        // child of DialogContent but does not render as one, so `>` silently
        // matches nothing - verified in a browser, not assumed.
        // `pt-2` on the sheet, restored to the dialog's own `p-6` at `sm:`.
        // The vendored padding is written for a centred modal, where 24px above
        // the first line is breathing room; on a full-screen sheet it is 24px of
        // a phone spent above a back arrow. 8px matches the topbar's own rhythm,
        // so the two app bars in the app sit their controls at the same height.
        //
        // The insets are *added to* those numbers, not substituted for them: the
        // sheet is `h-[100dvh]` and, under `viewport-fit=cover`, that really is
        // the whole screen. Without the top inset the back arrow sits under the
        // status bar - on the one surface with no system back to fall back on.
        // The side padding is the note's own text inset rather than chrome, so
        // the horizontal insets ride on top of it.
        //
        // There is deliberately **no bottom padding below `sm:`**. It used to
        // carry `1.5rem + --safe-bottom`, and that padding plus the note bar
        // below the editor is what held the format toolbar ~80px off the
        // keyboard: a `sticky` element cannot leave its parent's box, so the
        // toolbar bottomed out where the editor column ended rather than where
        // the sheet did. The toolbar now owns the bottom edge and the insets
        // that go with it (`EditorToolbar`, `useKeyboardInset`), and the note
        // bar rides inside the editor column as its `footer`.
        className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-3 overflow-y-auto rounded-none border-0 bg-note-surface! pt-[calc(0.5rem+var(--safe-top))] pr-[calc(1.5rem+var(--safe-right))] pb-0 pl-[calc(1.5rem+var(--safe-left))] sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-card sm:border sm:border-note-border sm:p-6 [&_[data-slot=dialog-close]]:hidden sm:[&_[data-slot=dialog-close]]:flex"
      >
        <DialogTitle className="sr-only">
          {noteId ? t('notes.editNoteTitle') : t('notes.newNoteTitle')}
        </DialogTitle>

        {/* Quiet local autosave indicator. M5 can extend this to Syncing /
            Offline states.

            One live region, two visual indicators. The region is always mounted
            and never moves: a screen reader only announces changes *inside* a
            region it was already observing, so one that appears together with
            its first message is silent - and one that exists twice, once per
            breakpoint, would be a second observer waiting to double-announce.
            The icons are `aria-hidden` decoration hung off it. */}
        <div aria-live="polite" className="sr-only">
          {saveStatus !== 'idle' && t(`notes.saveStatus.${saveStatus}`)}
        </div>

        {/* Mobile: the full-screen sheet gets a real app bar. Back sits top-left
            where a thumb can reach it and where "up" has meant something on
            every phone for a decade; the vendored close is an X in the far
            corner, which reads as discard and is the hardest point on the
            screen to hit one-handed. Desktop keeps that X - correct for a
            centred modal - and the indicator stays beside it. */}
        <AppBar
          // `-ml-3.5` puts the arrow's *glyph* on the same left edge as the
          // title and body below it, rather than its 44px box - an icon indented
          // further than the text it sits above reads as a mistake. 14px is that
          // box's own inset on a coarse pointer, where this bar lives; with a
          // mouse the button is 36px and the glyph lands 4px further out, which
          // is the direction to be wrong in.
          // `shrink-0` is not decoration: DialogContent is a column flex box
          // and the editor body below is `flex-1`, so without it the bar is a
          // shrinkable child and gets crushed to *zero height* as soon as the
          // content overflows - the arrow stays in the DOM, focusable, and 0x0.
          className="-ml-3.5 shrink-0 px-0 py-0 sm:hidden"
          left={
            // Calls `handleClose` directly rather than wrapping in
            // `DialogClose`: `asChild` forwards `data-slot="dialog-close"` onto
            // whatever it wraps, so the rule below that hides the vendored X on
            // mobile would hide this arrow with it. Same close path either way -
            // `onOpenChange` runs `handleClose` too.
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

        {/* Same 32px box as the close button, so the two icons share a centre
            line instead of the smaller one floating 8px high, and one gap of
            space between them rather than none. */}
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
          autoplayFirstAudio={autoplayFirstAudio}
          initialCapture={initialCapture}
          stickyToolbarOnMobile
          footer={isMobile ? noteBar : undefined}
          // Mobile: no bordered box, so the dialog's own padding is the only
          // spacing around the title + content. Desktop keeps the framed editor,
          // whose frame follows the note's identity like the dialog's own.
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
