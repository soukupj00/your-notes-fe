import 'fake-indexeddb/auto';
import { v4 as uuid } from 'uuid';
import { dummyNotes } from '@/db/dummyNotes.ts';
import type { NoteTag } from '@/models.ts';
import { db } from './db.ts';

async function seedDummyData() {
  await db.transaction('rw', db.notes, db.tags, db.noteTags, async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();

    const now = new Date(Date.now()).toISOString();

    const notes = dummyNotes;

    const tagsPool = ['Work', 'Personal', 'Health', 'Shopping', 'Travel', 'Study', 'Food', 'Ideas'];
    const tags = tagsPool.map((name) => ({ id: uuid(), name, createdAt: now, updatedAt: now }));
    await db.tags.bulkAdd(tags);

    await db.notes.bulkAdd(notes);

    const noteTags: NoteTag[] = [];

    notes.forEach((note) => {
      const tagCount = Math.floor(Math.random() * 4); // 0–3 tags
      const shuffledTags = tags.sort(() => Math.random() - 0.5).slice(0, tagCount);
      shuffledTags.forEach((tag) => {
        noteTags.push({ noteId: note.id, tagId: tag.id, createdAt: now, updatedAt: now });
      });
    });

    if (noteTags.length > 0) {
      await db.noteTags.bulkAdd(noteTags);
    }

    console.log(
      `✅ Inserted ${notes.length} notes, ${tags.length} tags, ${noteTags.length} relationships`
    );
  });
}

seedDummyData().catch(console.error);
