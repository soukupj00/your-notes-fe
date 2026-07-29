import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NotesView } from '@/components/notes/NotesView.tsx';
import { validateNoteSearch } from '@/lib/note-search-params.ts';

function NotesRoute() {
  const { t } = useTranslation();
  return <NotesView scope={{ state: 'active' }} title={t('nav.notes')} showCapture />;
}

export const Route = createFileRoute('/')({
  component: NotesRoute,
  validateSearch: validateNoteSearch,
});
