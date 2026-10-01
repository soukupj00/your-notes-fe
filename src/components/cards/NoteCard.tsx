import type React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CardActions } from '@/components/cards/CardActions.tsx';
import { CardMedia } from '@/components/cards/CardMedia.tsx';
import { CardPin } from '@/components/cards/CardPin.tsx';
import { NoteBody } from '@/components/NoteBody.tsx';
import { ReminderChip } from '@/components/reminders/ReminderChip.tsx';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { Card } from '@/components/ui/card.tsx';
import { type LifecycleSnapshot, useNoteActions } from '@/hooks/data/useNoteActions.ts';
import type { NoteAttachments } from '@/hooks/data/useNoteAttachments.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { checklistItemIndexAt, setChecklistItemChecked } from '@/lib/checklist.ts';
import { captureRows, playRows, type RowSnapshot } from '@/lib/flip-rows.ts';
import { attachLongPress } from '@/lib/long-press.ts';
import { stripAttachmentNodes } from '@/lib/note-attachments.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { pointOverText } from '@/lib/point-over-text.ts';
import { reminderOf } from '@/lib/reminder.ts';
import { cn, stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface NoteCardProps {
  note: Note;
  /**
   * The note's attachment rows, when the feed joined them on in one query.
   * Absent means the card resolves its own, the same fallback its labels use.
   */
  attachments?: NoteAttachments;
  onSelect: (id: string, opts?: { autoplayFirstAudio?: boolean }) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, attachments, onSelect }) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    updateNote,
    revertLifecycle,
    pinNote,
    unpinNote,
    archiveNote,
    trashNote,
    restoreToActive,
  } = useNoteActions();
  // The feed joins each note's labels on when it builds the entry
  // (`useNoteFeed`), so a card in the feed reads them off the note and skips the
  // query - otherwise every card would open a live query only to discard it. A
  // card handed a bare note still resolves its own labels.
  const liveTags = useTagsForNote(note.tags ? null : note.id);
  const tags = note.tags ?? liveTags;

  // Attachments are summarised by CardMedia, so the text preview renders the
  // prose only - otherwise an image-heavy note would show each attachment twice
  // and push its own words off the bottom of the clamp.
  const prose = stripAttachmentNodes(note.body);
  const hasProse = stripHtml(prose).trim().length > 0;

  // Hidden in Trash: a Note on its way out should not look like it still has
  // an appointment. The fields stay on the row, so Restore brings the chip back.
  const reminder = note.state === 'trashed' ? undefined : reminderOf(note);

  // Every lifecycle action follows the same contract: run the transition, then
  // offer its snapshot back as a one-click undo. Sharing the wrapper keeps a
  // new action from shipping without an undo.
  const withUndo =
    (run: (id: string) => Promise<LifecycleSnapshot | null>, message: string) => async () => {
      const before = await run(note.id);
      if (!before) return;
      toast(message, {
        action: { label: t('notes.undo'), onClick: () => revertLifecycle(note.id, before) },
      });
    };

  const handlePin = withUndo(pinNote, t('notes.pinned'));
  const handleUnpin = withUndo(unpinNote, t('notes.unpinned'));
  const handleArchive = withUndo(archiveNote, t('notes.archived'));
  const handleTrash = withUndo(trashNote, t('notes.movedToTrash'));
  const handleRestore = withUndo(restoreToActive, t('notes.restored'));

  // Read at click time, so two quick ticks compose instead of the second one
  // being computed from a body the first has already superseded. Written from an
  // effect rather than during render, and again from the handler itself.
  const bodyRef = useRef(note.body ?? '');
  useEffect(() => {
    bodyRef.current = note.body ?? '';
  }, [note.body]);

  const proseRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<RowSnapshot | null>(null);

  /**
   * Ticking a checklist item without opening the note (ADR 0013).
   *
   * Delegated because the body is `innerHTML`, so there is nothing to attach a
   * per-item handler to.
   *
   * The box and the item's words are the control (CONTEXT.md, Card); the empty
   * run after the words is still the card, which is why this bails before
   * `stopPropagation` unless one of the two was hit. Words, not the block that
   * holds them: a `<p>` spans the row, so it is asked by the text's own line
   * boxes. The native box flips itself when it is the thing tapped; when the
   * text is, the box is set here so the tap is answered on the same frame
   * either way, and the re-render that follows the write sets it from the
   * attribute regardless.
   */
  const handleChecklistClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const root = proseRef.current;
      if (!root) return;
      const target = event.target as Element;
      const item = target.closest('li[data-type="taskItem"]');
      if (!item) return;
      const onText = !target.closest('label') && pointOverText(item, event.clientX, event.clientY);
      if (!target.closest('label') && !onText) return;

      event.stopPropagation();

      const index = checklistItemIndexAt(root, item);
      if (index === null) return;
      const checked = item.getAttribute('data-checked') !== 'true';
      const box = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box) box.checked = checked;
      const nextBody = setChecklistItemChecked(bodyRef.current, index, checked);
      if (!nextBody) return;
      bodyRef.current = nextBody;

      // Measured now, while the DOM still shows the old order. The write is what
      // moves it: the live query echoes a new body, `NoteBody` re-renders, and
      // the CSS `order` rule re-lays-out the list.
      flipRef.current = reducedMotion ? null : captureRows(root);
      void updateNote(note.id, { body: nextBody });
    },
    [note.id, updateNote, reducedMotion]
  );

  // Runs after the rebuilt markup is in the DOM but before paint, which is the
  // only moment the rows can be animated from where they used to be. The rebuild
  // replaces every node, so this relies on rows matching by index rather than by
  // identity - see `flip-rows.ts`.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `prose` is the trigger, not an input. The effect reads only refs; it has to run when the body markup has just been re-rendered, and that is precisely what a change in `prose` means. Dropping it would leave the effect running once and never animating.
  useLayoutEffect(() => {
    const root = proseRef.current;
    // Only a body that really overflows gets the fade: dissolving the last line
    // of a note that simply ends would promise text that is not there.
    if (root) root.toggleAttribute('data-clipped', root.scrollHeight > root.clientHeight + 1);

    const before = flipRef.current;
    flipRef.current = null;
    if (before && root) playRows(root, before);
  }, [prose]);

  // Press-and-hold on a row opens the note, because the tap now ticks it. The
  // prose is rebuilt on every body change, but the listener sits on the
  // container `NoteBody` keeps, so it survives the rebuild.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hasProse` is the trigger, not an input. The container only exists while it is true, and a ref is not a dependency React can watch, so the effect has to re-run when the body gains its first prose.
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    return attachLongPress(root, {
      isTarget: (target) => target.closest('li[data-type="taskItem"]') !== null,
      onLongPress: () => onSelect(note.id),
    });
  }, [note.id, onSelect, hasProse]);

  const open = () => onSelect(note.id);
  const titleId = useId();

  return (
    <Card
      {...noteColorAttrs(note.color)}
      data-pinned={note.pinnedAt ? '' : undefined}
      // A click anywhere opens the note. Keyboards and screen readers use the open
      // button below instead, so the card is not one button whose name swallows the
      // rail's controls (controls nested in a button are invalid).
      onClick={open}
      className="group relative isolate w-full cursor-pointer break-inside-avoid gap-0 rounded-card border-0 bg-transparent py-0 text-card-foreground shadow-none has-[[data-slot=note-card-open]:focus-visible]:ring-2 has-[[data-slot=note-card-open]:focus-visible]:ring-ring has-[[data-slot=note-card-open]:focus-visible]:ring-offset-2 has-[[data-slot=note-card-open]:focus-visible]:ring-offset-background"
    >
      {/* Its click bubbles to the Card's `onClick`, so it needs no handler of its own. */}
      <button
        type="button"
        data-slot="note-card-open"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0"
        aria-labelledby={note.header ? titleId : undefined}
      >
        {note.header ? null : t('notes.editNoteTitle')}
      </button>

      {/* Only this material layer scales. Keeping text and media off the
          transformed layer prevents Chromium from bitmap-stretching them. */}
      <div
        data-slot="note-card-surface"
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-0 rounded-card border border-note-border bg-note-surface shadow-note group-hover:border-note-border-hover group-hover:shadow-note-lift',
          !reducedMotion &&
            'transition-[transform,border-color,box-shadow] duration-200 group-hover:scale-[1.02]'
        )}
      />

      {/* Outside the content layer so it stacks above the media too - the pin is
          never occluded by an attachment. Only shown for a note that can be
          pinned: pinning is meaningless in the archive and the trash. */}
      {note.state === 'active' && (
        <CardPin
          pinned={Boolean(note.pinnedAt)}
          onToggle={note.pinnedAt ? handleUnpin : handlePin}
        />
      )}

      {/* The foot rail's buttons carry ~4px of invisible touch padding below
          their 36px discs, so the card's own 13.6px bottom padding stacked into
          a ~18px gap under the icons against ~8px above them - visibly
          bottom-heavy on a phone. Trimming it here rather than in `--card-pad`
          keeps the token honest: the other three sides frame content, this one
          frames a control that already brings its own margin. */}
      <div className="relative z-10 p-[var(--card-pad)] coarse:pb-1">
        {/* Above the title, as in the lab: what a note *looks* like is the
            fastest way to recognise it again in a wall. */}
        <CardMedia
          noteId={note.id}
          body={note.body}
          attachments={attachments}
          onOpen={(opts) => onSelect(note.id, opts)}
        />

        {note.header && (
          <h2
            id={titleId}
            dir="auto"
            /* pe-9 reserves the pin's corner so a long title never runs under
               it. Reserved rather than revealed: the card's height must not
               change when the pointer arrives. */
            className="wrap-break-word mb-1.5 line-clamp-3 min-w-0 max-w-full text-pretty pe-9 font-display text-foreground text-title"
          >
            {note.header}
          </h2>
        )}

        {hasProse && (
          <NoteBody
            ref={proseRef}
            html={prose}
            onClick={handleChecklistClick}
            // `line-clamp-6` only bounds prose. A checklist row is `display:flex`
            // (globals.css), and `-webkit-line-clamp` counts line boxes only when
            // a block's children are block-level, so the clamp silently does
            // nothing on a checklist - measured, not assumed. `max-height` is the
            // bound that actually holds, and it is expressed in rows on a coarse
            // pointer because there a row is a 44px control, not a line of text.
            className="note-card-body wrap-anywhere line-clamp-6 max-h-[calc(6*1.45em)] min-w-0 max-w-full overflow-hidden text-body text-foreground [&_*]:max-w-full [&_li]:text-body [&_p]:text-body"
          />
        )}

        {/* Foot rail A from DESIGN.md. Labels get the flexible side; controls
            keep their real 44px hit areas and wrap below rather than squeezing
            the note's scarce horizontal axis. The rail owns its own `ml-auto`,
            which is what keeps it right-aligned on a note with no labels at
            all, so the pills do not need a matching `mr-auto`. */}
        {/* The rail's buttons already carry ~4px of invisible touch padding above
            and below their 36px discs, so the gap the eye sees is this margin
            plus that. 12px read as a hole on a phone, where the card is the
            scarce surface; 4px lands the visible gap at the same ~8px the rail
            keeps below itself. */}
        {/* `items-center`, not `items-end`. A pill is 21px and a control is 44px
            on a coarse pointer, so bottom-aligning them put the label 11px below
            the icons' centre line - which read, correctly, as a label sagging to
            the bottom of the card. It only showed where the two share a flex
            line (list view, or any card wide enough); in the grid the pills wrap
            to a line of their own and either value looks the same. */}
        <div className="coarse:mt-1 mt-3 flex flex-wrap items-center gap-2">
          {reminder && <ReminderChip reminder={reminder} />}

          <TagPills tags={tags} maxVisible={3} className="min-w-0" />

          <CardActions
            note={note}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onTrash={handleTrash}
            onColorChange={(color) => void updateNote(note.id, { color })}
          />
        </div>
      </div>
    </Card>
  );
};
