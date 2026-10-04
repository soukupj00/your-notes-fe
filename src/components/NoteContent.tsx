import { useTranslation } from 'react-i18next';
import { NoteFeed } from '@/components/notes/NoteFeed.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { type NoteFeedScope, useNoteFeed } from '@/hooks/data/useNoteFeed.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import type { Intent } from '@/lib/intent.ts';

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
  onSelect: (id: string, intent?: Intent) => void;
}) {
  const { search } = useNoteSearchState();
  const { notes, loading } = useNoteFeed(scope, search);
  const { viewMode } = useViewMode();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className="appear-late flex items-center justify-center gap-2 py-12"
        role="status"
        aria-busy
      >
        <Spinner className="size-5" />
        <span>{t('notes.loading')}</span>
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
        {key === 'active' ? (
          // The capture surface depends on width (ADR 0016): the dial below `sm:`, the bar above.
          <>
            <p className="max-w-xs text-sm sm:hidden">{t('notes.empty.active.subtitle')}</p>
            <p className="hidden max-w-xs text-sm sm:block">
              {t('notes.empty.active.subtitleWide')}
            </p>
          </>
        ) : (
          <p className="max-w-xs text-sm">{t(`notes.empty.${key}.subtitle`)}</p>
        )}
      </div>
    );
  }

  return <NoteFeed notes={notes} mode={viewMode} label={t('notes.feed')} onSelect={onSelect} />;
}
