import { Check } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useTags } from '@/hooks/data/useTags.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { INSTANT_TRANSITION, NIGHTSHIFT_SPRING } from '@/lib/motion.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Label filters for the feed, shown only once a search is under way - an
 * untouched feed should not be fronted by a wall of pills. Selecting several
 * narrows with AND ("things that are both work *and* urgent"), which is what
 * makes stacking them useful; OR would just be a longer list.
 */
export function TagFilterBar() {
  const { t } = useTranslation();
  const { search, toggleTag } = useNoteSearchState();
  const tags = useTags();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? INSTANT_TRANSITION : NIGHTSHIFT_SPRING;

  const searching = search.q.trim().length > 0 || search.tags.length > 0;
  if (!searching || tags.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-1 text-muted-foreground text-xs">{t('notes.filters.byLabel')}</p>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label={t('notes.filters.byLabel')}>
        {tags.map((tag) => {
          const selected = search.tags.includes(tag.id);
          return (
            <li key={tag.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTag(tag.id)}
                {...noteColorAttrs(tag.color)}
                className={cn(
                  'flex min-h-11 items-center gap-1 rounded-full bg-note-chip px-3 py-1 text-label text-note-on-chip uppercase transition-shadow',
                  'hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // Selection is carried by a real ring rather than by opacity:
                  // a dimmed pill reads as disabled, which is the opposite state.
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
