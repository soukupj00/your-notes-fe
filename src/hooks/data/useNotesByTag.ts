import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { useLiveQuery } from 'dexie-react-hooks';

export function useNotesByTag(tagId: string) {
  const notes: (Note | undefined)[] | undefined = useLiveQuery(async () => {
    if (!tagId) return [];

    // Get note-tag relationships for the given tag
    const noteTagRelations = await db.noteTags.where('tagId').equals(tagId).toArray();
    const noteIds = noteTagRelations.map((rel) => rel.noteId);

    if (noteIds.length === 0) return [];
    return db.notes.bulkGet(noteIds);
  }, [tagId]);

  return (notes ?? []).filter(Boolean) as Note[];
}
