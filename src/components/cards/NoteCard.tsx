import type React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/cards/CardActions.tsx';
import { CardMedia } from '@/components/cards/CardMedia.tsx';
import { CardPin } from '@/components/cards/CardPin.tsx';
import { NoteBody } from '@/components/NoteBody.tsx';
import { ReminderChip } from '@/components/reminders/ReminderChip.tsx';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { Card } from '@/components/ui/card.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import type { NoteAttachments } from '@/hooks/data/useNoteAttachments.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { useUndoableLifecycle } from '@/hooks/useUndoableLifecycle.ts';
import {
  checklistBox,
  checklistItemIndexAt,
  closestChecklistItem,
  isChecklistItemChecked,
  setChecklistItemChecked,
  stripAttachmentNodes,
} from '@/lib/body.ts';
import { captureRows, playRows, type RowSnapshot } from '@/lib/flip-rows.ts';
import type { Intent } from '@/lib/intent.ts';
import { attachLongPress } from '@/lib/long-press.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { pointOverText } from '@/lib/point-over-text.ts';
import { reminderOf } from '@/lib/reminder.ts';
import { cn, stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface NoteCardProps {
  note: Note;
  /** Rows the feed already joined on; absent means the card resolves its own. */
  attachments?: NoteAttachments;
  onSelect: (id: string, intent?: Intent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, attachments, onSelect }) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { updateNote } = useNoteActions();
  const lifecycle = useUndoableLifecycle();
  // A feed card reads the labels `useNoteFeed` joined on; only a bare note opens its own query.
  const liveTags = useTagsForNote(note.tags ? null : note.id);
  const tags = note.tags ?? liveTags;

  // CardMedia summarises attachments, so the preview is prose only and shows nothing twice.
  const prose = stripAttachmentNodes(note.body);
  const hasProse = stripHtml(prose).trim().length > 0;

  // Hidden in Trash: a Note on its way out should not look like it still has
  // an appointment. The fields stay on the row, so Restore brings the chip back.
  const reminder = note.state === 'trashed' ? undefined : reminderOf(note);

  const handlePin = () => lifecycle.pin(note.id);
  const handleUnpin = () => lifecycle.unpin(note.id);
  const handleArchive = () => lifecycle.archive(note.id);
  const handleTrash = () => lifecycle.trash(note.id);
  const handleRestore = () => lifecycle.restore(note.id);

  // Read at click time and written by the handler too, so two quick ticks compose
  // instead of the second being computed from a body the first already replaced.
  const bodyRef = useRef(note.body ?? '');
  useEffect(() => {
    bodyRef.current = note.body ?? '';
  }, [note.body]);

  const proseRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<RowSnapshot | null>(null);

  /**
   * Ticks a checklist item in place (ADR 0013), delegated because the body is `innerHTML`.
   * Only the box and the item's words are the control (CONTEXT.md, Card); anything else falls
   * through to the card. The box is set here too, so a tap on the words answers on this frame.
   */
  const handleChecklistClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const root = proseRef.current;
      if (!root) return;
      const target = event.target as Element;
      const item = closestChecklistItem(target);
      if (!item) return;
      const onText = !target.closest('label') && pointOverText(item, event.clientX, event.clientY);
      if (!target.closest('label') && !onText) return;

      event.stopPropagation();

      const index = checklistItemIndexAt(root, item);
      if (index === null) return;
      const checked = !isChecklistItemChecked(item);
      const box = checklistBox(item);
      if (box) box.checked = checked;
      const nextBody = setChecklistItemChecked(bodyRef.current, index, checked);
      if (!nextBody) return;
      bodyRef.current = nextBody;

      // Measured before the write, whose echoed body re-renders and lets CSS `order` move the rows.
      flipRef.current = reducedMotion ? null : captureRows(root);
      void updateNote(note.id, { body: nextBody });
    },
    [note.id, updateNote, reducedMotion]
  );

  // Before paint is the only moment the rows can animate from where they were. The rebuild
  // replaces every node, so rows match by index, not identity (`flip-rows.ts`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `prose` is the trigger; the effect reads only refs and must rerun after each body re-render.
  useLayoutEffect(() => {
    const root = proseRef.current;
    // Fade only real overflow: on a note that simply ends it would promise text that is not there.
    if (root) root.toggleAttribute('data-clipped', root.scrollHeight > root.clientHeight + 1);

    const before = flipRef.current;
    flipRef.current = null;
    if (before && root) playRows(root, before);
  }, [prose]);

  // Every open focuses the open button first: the editor returns focus to
  // whatever had it, so a pointer open would otherwise close back onto `body`.
  const openRef = useRef<HTMLButtonElement>(null);
  const select = useCallback(
    (...rest: [intent?: Intent]) => {
      openRef.current?.focus({ preventScroll: true });
      onSelect(note.id, ...rest);
    },
    [note.id, onSelect]
  );

  // Press-and-hold opens the note, because a tap on a row ticks it. The listener sits on the
  // container `NoteBody` keeps, so it survives the prose being rebuilt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hasProse` is the trigger; the container exists only while it is true, and a ref cannot be watched.
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    return attachLongPress(root, {
      isTarget: (target) => closestChecklistItem(target) !== null,
      onLongPress: () => select(),
    });
  }, [select, hasProse]);

  const title = note.header?.trim();
  const titleId = useId();

  return (
    <Card
      {...noteColorAttrs(note.color)}
      data-pinned={note.pinnedAt ? '' : undefined}
      // A click anywhere opens the note. Keyboards and screen readers use the open button
      // instead, so the card is not one button swallowing the rail's controls (invalid nesting).
      // A portal's clicks (a dialog the rail opened) bubble here through React, not the page.
      onClick={(e) => {
        if (e.currentTarget.contains(e.target as Node)) select();
      }}
      className="group relative isolate w-full cursor-pointer break-inside-avoid gap-0 rounded-card border-0 bg-transparent py-0 text-card-foreground shadow-none has-[[data-slot=note-card-open]:focus-visible]:ring-2 has-[[data-slot=note-card-open]:focus-visible]:ring-ring has-[[data-slot=note-card-open]:focus-visible]:ring-offset-2 has-[[data-slot=note-card-open]:focus-visible]:ring-offset-background"
    >
      {/* Its click bubbles to the Card's `onClick`, so it needs no handler of its own. */}
      <button
        type="button"
        ref={openRef}
        data-slot="note-card-open"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0"
        aria-labelledby={title ? titleId : undefined}
      >
        {title ? null : t('notes.editNoteTitle')}
      </button>

      {/* Only this layer scales (DESIGN.md, Scale-The-Surface-Never-The-Text Rule). */}
      <div
        data-slot="note-card-surface"
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-0 rounded-card border border-note-border bg-note-surface shadow-note group-hover:border-note-border-hover group-hover:shadow-note-lift',
          !reducedMotion &&
            'transition-[transform,border-color,box-shadow] duration-200 group-hover:scale-[1.02]'
        )}
      />

      {/* Outside the content layer so it stacks above media (DESIGN.md, Pin-Is-Always-In-Front
          Rule). Active only: pinning means nothing in Archive or Trash. */}
      {note.state === 'active' && (
        <CardPin
          pinned={Boolean(note.pinnedAt)}
          onToggle={note.pinnedAt ? handleUnpin : handlePin}
        />
      )}

      <div className="relative z-10 p-[var(--card-pad)] coarse:pb-1">
        {/* Above the title: how a note looks is the fastest way to recognise it in a wall. */}
        <CardMedia noteId={note.id} body={note.body} attachments={attachments} onOpen={select} />

        {title && (
          <h2
            id={titleId}
            dir="auto"
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
            // `line-clamp-6` silently does nothing on a checklist, whose rows are flex (measured),
            // so `max-height` is the bound that actually holds.
            className="note-card-body wrap-anywhere line-clamp-6 max-h-[calc(6*1.45em)] min-w-0 max-w-full overflow-hidden text-body text-foreground [&_*]:max-w-full [&_li]:text-body [&_p]:text-body"
          />
        )}

        {/* Foot rail A (DESIGN.md, Card anatomy). */}
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
