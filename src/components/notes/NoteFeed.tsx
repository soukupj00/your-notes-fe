import { AnimatePresence, m } from 'motion/react';
import { useMemo } from 'react';
import { NoteCard } from '@/components/cards/NoteCard.tsx';
import type { ViewMode } from '@/context/viewModeProvider.tsx';
import { useAttachmentsByNote } from '@/hooks/data/useNoteAttachments.ts';
import { useNoteFeedLayout } from '@/hooks/useNoteFeedLayout.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { PRESENCE_TRANSITION, resolveTransition } from '@/lib/motion.ts';
import type { Note } from '@/models.ts';

type NoteFeedProps = {
  notes: Note[];
  mode: ViewMode;
  label: string;
  onSelect: (id: string, opts?: { autoplayFirstAudio?: boolean }) => void;
};

/**
 * One semantic feed and one placement path for both Masonry and Stack.
 *
 * The DOM remains in feed order. Only each item's x/y/width target changes, so
 * switching layouts or reordering notes preserves visual continuity without
 * changing reading or keyboard order.
 */
export function NoteFeed({ notes, mode, label, onSelect }: NoteFeedProps) {
  const ids = useMemo(() => notes.map((note) => note.id), [notes]);
  // One query for the whole wall rather than one per card. Each note keeps its
  // own Map identity across refires, so a write to one note does not re-mint
  // every other card's thumbnails (see `useAttachmentsByNote`).
  const attachmentsByNote = useAttachmentsByNote(ids);
  const reducedMotion = useReducedMotion();
  const { containerRef, layout, ready, supported } = useNoteFeedLayout(mode, ids);
  const layoutTransition = resolveTransition(reducedMotion);
  const presenceTransition = resolveTransition(reducedMotion, PRESENCE_TRANSITION);

  // ResizeObserver is the progressive-enhancement seam. Without measurement,
  // Stack remains a complete, readable, DOM-ordered feed rather than an
  // overlapping imitation of Masonry.
  if (!supported) {
    return (
      <ul
        className="mx-auto flex w-full max-w-[44rem] flex-col gap-[var(--feed-gap)]"
        aria-label={label}
        data-layout="stack"
      >
        {notes.map((note) => (
          <li key={note.id}>
            <NoteCard
              note={note}
              attachments={attachmentsByNote.get(note.id)}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <m.ul
      ref={containerRef}
      aria-label={label}
      aria-busy={!ready}
      data-layout={mode}
      data-layout-ready={ready || undefined}
      className="relative w-full list-none gap-[var(--feed-gap)] p-0"
      initial={false}
      animate={{ height: layout.height }}
      transition={{ height: layoutTransition }}
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    >
      <AnimatePresence initial={false}>
        {notes.map((note) => {
          const placement = layout.placements[note.id];

          // A new card has to exist before ResizeObserver can measure it, but it
          // must not appear at the absolute-positioning origin while that first
          // placement is being calculated. Measure it invisibly at the final
          // column width, then mount Motion only once x/y/width are all known.
          if (!placement) {
            return (
              <li
                key={note.id}
                data-note-feed-id={note.id}
                aria-hidden
                className="invisible absolute top-0 left-0"
                style={{ width: layout.itemWidth || '100%' }}
              >
                <NoteCard
                  note={note}
                  attachments={attachmentsByNote.get(note.id)}
                  onSelect={onSelect}
                />
              </li>
            );
          }

          return (
            // These measured values are animation targets, not static styles.
            // A layout-effect measurement can commit before Motion captures a
            // projection snapshot, which makes static left/top/width changes
            // jump directly to their destination instead of animating.
            <m.li
              key={note.id}
              data-note-feed-id={note.id}
              initial={{
                x: placement.x,
                y: placement.y,
                width: placement.width,
                opacity: 0,
              }}
              animate={{
                x: placement.x,
                y: placement.y,
                width: placement.width,
                opacity: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{
                x: layoutTransition,
                y: layoutTransition,
                width: layoutTransition,
                opacity: presenceTransition,
              }}
              className="absolute top-0 left-0"
            >
              <NoteCard
                note={note}
                attachments={attachmentsByNote.get(note.id)}
                onSelect={onSelect}
              />
            </m.li>
          );
        })}
      </AnimatePresence>
    </m.ul>
  );
}
