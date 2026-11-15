import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyTrashButton } from '@/components/notes/EmptyTrashButton.tsx';
import { NotesView } from '@/components/notes/NotesView.tsx';
import { TRASH_GRACE_DAYS } from '@/hooks/data/useNoteActions.ts';
import { validateNoteSearch } from '@/lib/note-search-params.ts';

function TrashRoute() {
  const { t } = useTranslation();

  return (
    <NotesView
      scope={{ state: 'trashed' }}
      title={t('nav.trash')}
      toolbar={
        <>
          <p className="hidden text-muted-foreground text-xs sm:block">
            {t('notes.trashNotice', { days: TRASH_GRACE_DAYS })}
          </p>
          <EmptyTrashButton />
        </>
      }
    />
  );
}

export const Route = createFileRoute('/trash')({
  component: TrashRoute,
  validateSearch: validateNoteSearch,
});
