import { db } from '@/db/db.ts';
import type { Note, Tag } from '@/models.ts';
import { useLiveQuery } from 'dexie-react-hooks';

export function useSearchNotes(query: string) {
  const notes: (Note | undefined)[] | undefined = useLiveQuery(async () => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();

    // 1. Search notes by text fields
    const allNotes: Note[] = await db.notes.toArray();
    const matchingNotes: Note[] = allNotes.filter((note) => {
      const matchesHeader = note.header?.toLowerCase().includes(lowerQuery);
      const matchesDescription = note.description?.toLowerCase().includes(lowerQuery);
      const matchesChecklist = note.checklist?.some((item) =>
        item.toLowerCase().includes(lowerQuery)
      );
      const matchesDates =
        note.createdAt.toLowerCase().includes(lowerQuery) ||
        note.updatedAt.toLowerCase().includes(lowerQuery);

      return matchesHeader || matchesDescription || matchesChecklist || matchesDates;
    });

    // 2. Search tags
    const matchingTags: Tag[] = await db.tags
      .filter((tag) => tag.name.toLowerCase().includes(lowerQuery))
      .toArray();

    if (matchingTags.length === 0) {
      return matchingNotes; // No tag matches, return note text matches only
    }

    // 3. Find notes associated with matching tags
    const tagIds = matchingTags.map((tag) => tag.id);
    const noteTags = await db.noteTags.filter((rel) => tagIds.includes(rel.tagId)).toArray();

    const notesWithMatchingTags = await db.notes.bulkGet(noteTags.map((rel) => rel.noteId));

    // Merge and remove duplicates
    const combined = [...matchingNotes, ...notesWithMatchingTags.filter(Boolean)];

    return Array.from(new Map(combined.map((n) => [n?.id, n])).values());
  }, [query]);

  return notes ?? [];
}
