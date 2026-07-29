import { v4 as uuid } from 'uuid';
import { dummyNotes } from '@/db/dummyNotes.ts';
import type { NoteTag, Tag } from '@/models.ts';
import { db } from './db.ts';

const TAG_POOL: { name: string; color?: string }[] = [
  { name: 'Work', color: 'blue' },
  { name: 'Personal', color: 'pink' },
  { name: 'Health', color: 'green' },
  { name: 'Shopping', color: 'orange' },
  { name: 'Travel', color: 'teal' },
  { name: 'Study', color: 'purple' },
  { name: 'Food' },
  { name: 'Ideas' },
];

/**
 * Wipe and repopulate notes/tags/noteTags with the sample data. Shared by the
 * Node seeder (`pnpm seed`, against fake-indexeddb) and the in-browser seeder,
 * which previously carried two drifting copies of this.
 */
export async function seedDummyData() {
  return db.transaction('rw', db.notes, db.tags, db.noteTags, async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();

    const now = new Date(Date.now()).toISOString();

    const tags: Tag[] = TAG_POOL.map(({ name, color }) => ({
      id: uuid(),
      name,
      color,
      createdAt: now,
      updatedAt: now,
    }));
    await db.tags.bulkAdd(tags);
    await db.notes.bulkAdd(dummyNotes);

    const noteTags: NoteTag[] = [];
    for (const note of dummyNotes) {
      const tagCount = Math.floor(Math.random() * 4); // 0-3 tags
      // Copy before shuffling: sorting `tags` in place would reorder the array
      // we just persisted and make the assignment order confusing to debug.
      const picked = [...tags].sort(() => Math.random() - 0.5).slice(0, tagCount);
      for (const tag of picked) {
        noteTags.push({ noteId: note.id, tagId: tag.id, createdAt: now, updatedAt: now });
      }
    }

    if (noteTags.length > 0) await db.noteTags.bulkAdd(noteTags);

    return { notes: dummyNotes.length, tags: tags.length, noteTags: noteTags.length };
  });
}
