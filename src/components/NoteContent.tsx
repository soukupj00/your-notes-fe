import { useTranslation } from 'react-i18next';
import { NoteFeed } from '@/components/notes/NoteFeed.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { type NoteFeedScope, useNoteFeed } from '@/hooks/data/useNoteFeed.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';

const MASONRY_SKELETONS =
  'grid grid-cols-1 gap-[0.85rem] min-[22rem]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
const STACK_SKELETONS = 'grid grid-cols-1 gap-[0.85rem]';

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
  const skeletonLayout = viewMode === 'masonry' ? MASONRY_SKELETONS : STACK_SKELETONS;

  if (loading) {
    return (
      // `role="status"`: the skeletons are decoration, so the wait needs a name
      // of its own or a screen reader hears nothing at all while the feed loads.
      <div className={skeletonLayout} role="status" aria-busy aria-label={t('notes.loading')}>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <Skeleton key={k} className="h-32 w-full" />
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

  return <NoteFeed notes={notes} mode={viewMode} label={t('notes.feed')} onSelect={onSelect} />;
}
