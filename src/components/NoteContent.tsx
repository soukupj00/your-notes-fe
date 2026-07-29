import { useTranslation } from 'react-i18next';
import { NoteCard } from '@/components/cards/NoteCard.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { type NoteFeedScope, useNoteFeed } from '@/hooks/data/useNoteFeed.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';

// Responsive masonry via CSS `columns` (no JS lib). Cards must not split across
// columns, so each carries `break-inside-avoid` (see NoteCard). Note: CSS
// columns fill column-major, so ordering is top-of-column-1 down, not row-major.
const MASONRY = 'columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4';
// Single-column reading list, centered and width-capped for comfortable line length.
const LIST = 'mx-auto flex max-w-2xl flex-col gap-4';

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
  const layout = viewMode === 'list' ? LIST : MASONRY;

  if (loading) {
    return (
      <div className={layout}>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <Skeleton key={k} className="mb-4 h-32 w-full break-inside-avoid" />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
        {search.q.trim() || search.tags.length > 0 ? (
          <p>{t('notes.noResults')}</p>
        ) : (
          <>
            <p className="font-medium text-foreground text-lg">{t('notes.empty.title')}</p>
            <p className="max-w-xs text-sm">{t('notes.empty.subtitle')}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={layout}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onSelect={onSelect} />
      ))}
    </div>
  );
}
