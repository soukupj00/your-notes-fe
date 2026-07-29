import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NotesView } from '@/components/notes/NotesView.tsx';

function ArchiveRoute() {
  const { t } = useTranslation();
  return <NotesView scope={{ state: 'archived' }} title={t('nav.archive')} />;
}

export const Route = createFileRoute('/archive')({ component: ArchiveRoute });
