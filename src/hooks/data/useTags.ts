import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import type { Tag } from '@/models.ts';

export function useTags() {
  const tags: Tag[] | undefined = useLiveQuery(async () => {
    return db.tags.toArray();
  }, []);

  return tags ?? [];
}
