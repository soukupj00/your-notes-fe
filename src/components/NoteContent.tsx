import { useTranslation } from 'react-i18next';
import { NoteCard } from '@/components/cards/NoteCard.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useNotes } from '@/context/NotesProvider.tsx';

// Responsive masonry via CSS `columns` (no JS lib). Cards must not split across
// columns, so each carries `break-inside-avoid` (see NoteCard). Note: CSS
// columns fill column-major, so ordering is top-of-column-1 down, not row-major.
const MASONRY = 'columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4';

export function NoteContent({ onSelect }: { onSelect: (id: string) => void }) {
  const { notes, query, loading } = useNotes();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={MASONRY}>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <Skeleton key={k} className="mb-4 h-32 w-full break-inside-avoid" />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
        {query.trim() ? (
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
    <div className={MASONRY}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onSelect={onSelect} />
      ))}
    </div>
  );
}
