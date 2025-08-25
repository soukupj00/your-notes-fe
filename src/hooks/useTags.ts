import { db } from '@/db/db';
import type { Tag } from '@/models';
import { useLiveQuery } from 'dexie-react-hooks';

export function useTags() {
  const tags: Tag[] | undefined = useLiveQuery(async () => {
    return db.tags.toArray();
  }, []);

  return tags ?? [];
}
