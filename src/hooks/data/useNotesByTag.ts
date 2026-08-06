import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';

export function useNotesByTag(tagId: string) {
  const notes: (Note | undefined)[] | undefined = useLiveQuery(async () => {
    if (!tagId) return [];

    const noteTagRelations = await db.noteTags.where('tagId').equals(tagId).toArray();
    const noteIds = noteTagRelations.map((rel) => rel.noteId);

    if (noteIds.length === 0) return [];
    return db.notes.bulkGet(noteIds);
  }, [tagId]);

  return (notes ?? []).filter(Boolean) as Note[];
}
