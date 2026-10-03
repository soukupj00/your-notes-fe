import { AnimatePresence, m } from 'motion/react';
import { useMemo } from 'react';
import { NoteCard } from '@/components/cards/NoteCard.tsx';
import type { ViewMode } from '@/context/viewModeProvider.tsx';
import { useAttachmentsByNote } from '@/hooks/data/useNoteAttachments.ts';
import { useNoteFeedLayout } from '@/hooks/useNoteFeedLayout.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import type { Intent } from '@/lib/intent.ts';
import { PRESENCE_TRANSITION, resolveTransition } from '@/lib/motion.ts';
import type { Note } from '@/models.ts';

type NoteFeedProps = {
  notes: Note[];
  mode: ViewMode;
  label: string;
  onSelect: (id: string, intent?: Intent) => void;
};

/**
 * One placement path for Masonry and Stack (DESIGN.md, Layout): only each card's x/y/width
 * target changes, so DOM order stays reading order through every switch.
 */
export function NoteFeed({ notes, mode, label, onSelect }: NoteFeedProps) {
  const ids = useMemo(() => notes.map((note) => note.id), [notes]);
  // One query for the whole wall. Each note keeps its Map identity across refires, so a write
  // to one note does not re-mint every other card's thumbnails.
  const attachmentsByNote = useAttachmentsByNote(ids);
  const reducedMotion = useReducedMotion();
  const { containerRef, layout, ready, supported } = useNoteFeedLayout(mode, ids);
  const layoutTransition = resolveTransition(reducedMotion);
  const presenceTransition = resolveTransition(reducedMotion, PRESENCE_TRANSITION);

  // Without ResizeObserver, a plain Stack is the honest fallback rather than a broken Masonry.
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

          // A new card must exist to be measured but must not flash at the origin meanwhile,
          // so it is measured invisibly and gets Motion only once it is placed.
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
            // Animation targets, not static styles: a measurement can commit before Motion's
            // snapshot, and static left/top/width would then jump instead of animating.
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
