import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NotesView } from '@/components/notes/NotesView.tsx';
import { Button } from '@/components/ui/button.tsx';
import { TRASH_GRACE_DAYS, useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { validateNoteSearch } from '@/lib/note-search-params.ts';

function EmptyTrashButton() {
  const { t } = useTranslation();
  const { emptyTrash } = useNoteActions();

  const handleEmpty = async () => {
    const count = await emptyTrash();
    // Nothing to report (and nothing to undo) when the trash was already empty.
    if (count > 0) toast(t('notes.trashEmptied', { count }));
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleEmpty}>
      {t('notes.emptyTrash')}
    </Button>
  );
}

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
