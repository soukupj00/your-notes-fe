import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import type { Tag } from '@/models.ts';

export function useTagsForNote(noteId: string) {
  const tags: (Tag | undefined)[] | undefined = useLiveQuery(async () => {
    if (!noteId) return [];

    const noteTagRelations = await db.noteTags.where('noteId').equals(noteId).toArray();
    const tagIds = noteTagRelations.map((rel) => rel.tagId);

    if (tagIds.length === 0) return [];
    return db.tags.bulkGet(tagIds);
  }, [noteId]);

  return (tags ?? []).filter(Boolean) as Tag[];
}
