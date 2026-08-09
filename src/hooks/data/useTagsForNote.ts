import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import type { Tag } from '@/models.ts';

/**
 * A note's labels, live.
 *
 * `noteId` is nullable so a caller that already has the labels can skip the
 * query outright - the feed joins them on when it builds each entry, and running
 * this once per card would open a live query per card only to discard it.
 */
export function useTagsForNote(noteId: string | null | undefined) {
  const tags: (Tag | undefined)[] | undefined = useLiveQuery(async () => {
    if (!noteId) return [];

    const noteTagRelations = await db.noteTags.where('noteId').equals(noteId).toArray();
    const tagIds = noteTagRelations.map((rel) => rel.tagId);

    if (tagIds.length === 0) return [];
    return db.tags.bulkGet(tagIds);
  }, [noteId]);

  return (tags ?? []).filter(Boolean) as Tag[];
}
