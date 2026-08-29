import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NotesView } from '@/components/notes/NotesView.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';
import { validateNoteSearch } from '@/lib/note-search-params.ts';

function TagRoute() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const store = useLocalStore();
  const tag = useLive(() => store.tags.watch(id), [store, id]);

  // The tag name is the heading, so fall back to a neutral label while the
  // lookup resolves (or if the tag was deleted in another tab).
  return <NotesView scope={{ state: 'active', tagId: id }} title={tag?.name ?? t('nav.labels')} />;
}

export const Route = createFileRoute('/tag/$id')({
  component: TagRoute,
  validateSearch: validateNoteSearch,
});
