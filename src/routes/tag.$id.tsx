import { createFileRoute } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { NotesView } from '@/components/notes/NotesView.tsx';
import { db } from '@/db/db.ts';

function TagRoute() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const tag = useLiveQuery(() => db.tags.get(id), [id]);

  // The tag name is the heading, so fall back to a neutral label while the
  // lookup resolves (or if the tag was deleted in another tab).
  return <NotesView scope={{ state: 'active', tagId: id }} title={tag?.name ?? t('nav.labels')} />;
}

export const Route = createFileRoute('/tag/$id')({ component: TagRoute });
