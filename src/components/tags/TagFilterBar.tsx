import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTags } from '@/hooks/data/useTags.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { resolveTransition } from '@/lib/motion.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';

/**
 * Shown only once a search is under way, so an untouched feed is not fronted by pills.
 * Several selected narrow with AND, which is what makes stacking them useful.
 */
export function TagFilterBar() {
  const { t } = useTranslation();
  const { search, toggleTag } = useNoteSearchState();
  const tags = useTags();
  const reducedMotion = useReducedMotion();
  const transition = resolveTransition(reducedMotion);

  // Once, as the bar appears: a pill tapped later is already in view, and scrolling then would
  // move the row under the finger.
  const revealFirstSelected = useCallback((row: HTMLUListElement | null) => {
    if (!row || row.scrollWidth <= row.clientWidth) return;
    row
      .querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  const searching = search.q.trim().length > 0 || search.tags.length > 0;
  if (!searching || tags.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-1 text-muted-foreground text-xs">{t('notes.filters.byLabel')}</p>
      {/* Below `sm:` the row bleeds through the page gutter `layout.tsx` sets; keep the two in step. */}
      <ul
        ref={revealFirstSelected}
        className={clsx(
          'filter-row flex flex-wrap items-center gap-1.5',
          'max-sm:-my-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:py-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden',
          'max-sm:-mr-[calc(1rem+var(--safe-right))] max-sm:-ml-[calc(1rem+var(--safe-left))] max-sm:pr-[calc(1rem+var(--safe-right))] max-sm:pl-[calc(1rem+var(--safe-left))]',
          'max-sm:scroll-pr-[calc(2.5rem+var(--safe-right))] max-sm:scroll-pl-[calc(2.5rem+var(--safe-left))]'
        )}
        aria-label={t('notes.filters.byLabel')}
      >
        {tags.map((tag) => {
          const selected = search.tags.includes(tag.id);
          return (
            <li key={tag.id} className="max-w-full shrink-0">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTag(tag.id)}
                {...noteColorAttrs(tag.color)}
                // `clsx`, not `cn`: tailwind-merge reads `text-label` as a colour and drops it
                // next to `text-note-on-chip`, taking the 11px size with it.
                className={clsx(
                  'flex min-h-11 max-w-full items-center gap-1 rounded-full bg-note-chip px-3 py-1 text-label text-note-on-chip uppercase transition-shadow',
                  'hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // A ring, not opacity: a dimmed pill reads as disabled, the opposite state.
                  selected ? 'ring-2 ring-note-swatch-ring' : ''
                )}
              >
                <AnimatePresence initial={false}>
                  {selected && (
                    <m.span
                      key="selected"
                      initial={reducedMotion ? false : { width: 0, opacity: 0, scale: 0.6 }}
                      animate={{ width: 12, opacity: 1, scale: 1 }}
                      exit={{ width: 0, opacity: 0, scale: 0.6 }}
                      transition={transition}
                      className="flex overflow-hidden"
                    >
                      <Check className="size-3 shrink-0" aria-hidden />
                    </m.span>
                  )}
                </AnimatePresence>
                <span className="truncate">{tag.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
