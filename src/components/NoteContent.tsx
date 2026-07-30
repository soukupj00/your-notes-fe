import { useTranslation } from 'react-i18next';
import { NoteCard } from '@/components/cards/NoteCard.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { type NoteFeedScope, useNoteFeed } from '@/hooks/data/useNoteFeed.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { cn } from '@/lib/utils.ts';

// Responsive masonry via CSS `columns` (no JS lib). Cards must not split across
// columns, so each carries `break-inside-avoid` (see NoteCard). Note: CSS
// columns fill column-major, so ordering is top-of-column-1 down, not row-major.
const MASONRY = 'columns-1 gap-[0.85rem] sm:columns-2 lg:columns-3 xl:columns-4';
// Single-column reading list, centered and width-capped for comfortable line length.
const LIST = 'mx-auto flex max-w-2xl flex-col gap-[0.85rem]';

/** Which `notes.empty.*` copy block describes an empty feed in this scope. */
function emptyKeyFor(scope: NoteFeedScope): string {
  if (scope.state === 'archived') return 'archived';
  if (scope.state === 'trashed') return 'trashed';
  return scope.tagId ? 'tag' : 'active';
}

export function NoteContent({
  scope,
  onSelect,
}: {
  scope: NoteFeedScope;
  onSelect: (id: string, opts?: { autoplayFirstAudio?: boolean }) => void;
}) {
  const { search } = useNoteSearchState();
  const { notes, loading } = useNoteFeed(scope, search);
  const { viewMode } = useViewMode();
  const { t } = useTranslation();
  const masonry = viewMode === 'masonry';
  const layout = masonry ? MASONRY : LIST;

  if (loading) {
    return (
      // `role="status"`: the skeletons are decoration, so the wait needs a name
      // of its own or a screen reader hears nothing at all while the feed loads.
      <div className={layout} role="status" aria-busy aria-label={t('notes.loading')}>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <Skeleton
            key={k}
            className={cn('h-32 w-full break-inside-avoid', masonry && 'mb-[0.85rem]')}
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    // A filtered-to-nothing feed is a different message from a genuinely empty
    // one, and each lifecycle view says what *it* is empty of - "No notes yet"
    // is wrong copy for an empty trash.
    const filtered = search.q.trim().length > 0 || search.tags.length > 0;
    const key = filtered ? 'filtered' : emptyKeyFor(scope);

    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
        <p className="font-medium text-foreground text-lg">{t(`notes.empty.${key}.title`)}</p>
        <p className="max-w-xs text-sm">{t(`notes.empty.${key}.subtitle`)}</p>
      </div>
    );
  }

  // A list, not a stack of divs: the feed is a countable collection, so screen
  // readers should be able to announce its size and let the user step through it.
  return (
    <ul className={layout} aria-label={t('notes.feed')}>
      {notes.map((note) => (
        <li key={note.id} className={cn('break-inside-avoid', masonry && 'mb-[0.85rem]')}>
          <NoteCard note={note} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
