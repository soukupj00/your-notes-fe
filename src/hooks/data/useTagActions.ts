import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import type { Tag } from '@/models.ts';

export function useTagActions() {
  // CREATE a new tag
  const createTag = async (name: string) => {
    const now = new Date().toISOString();
    const newTag: Tag = { id: uuid(), name, createdAt: now, updatedAt: now };
    await db.tags.add(newTag);
    return newTag;
  };

  // UPDATE an existing tag
  const updateTag = async (id: string, newName: string) => {
    const tag = await db.tags.get(id);
    if (!tag) return null;

    const updatedTag = { ...tag, name: newName };
    await db.tags.put(updatedTag);
    return updatedTag;
  };

  // DELETE a tag (remove from tags table and all relationships in noteTags)
  const deleteTag = async (id: string) => {
    await db.transaction('rw', db.tags, db.noteTags, async () => {
      await db.tags.delete(id);
      await db.noteTags.where('tagId').equals(id).delete();
    });
  };

  // ASSIGN a tag to a note
  const addTagToNote = async (noteId: string, tagId: string) => {
    const exists = await db.noteTags.where({ noteId, tagId }).first();

    if (!exists) {
      const now = new Date().toISOString();
      await db.noteTags.add({ noteId, tagId, createdAt: now, updatedAt: now });
    }
  };

  // REMOVE a tag from a note
  const removeTagFromNote = async (noteId: string, tagId: string) => {
    await db.noteTags.where({ noteId, tagId }).delete();
  };

  return { createTag, updateTag, deleteTag, addTagToNote, removeTagFromNote };
}
