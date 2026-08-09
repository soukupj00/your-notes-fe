import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import type { Tag } from '@/models.ts';

/** The fields a user can edit on a Tag. An explicit `color: undefined` clears it. */
export type TagChanges = {
  name?: string;
  color?: string;
};

export function useTagActions() {
  /**
   * CREATE a tag, or return the existing one when the name is already taken.
   * Names are compared case-insensitively: create-on-the-fly runs from a free
   * text field, so typing "work" must not mint a second copy of "Work".
   */
  const createTag = async (name: string, color?: string) => {
    const trimmed = name.trim();
    // Through the `name` index rather than a scan of every tag: this runs on
    // each keystroke-driven create from the label field.
    const existing = await db.tags.where('name').equalsIgnoreCase(trimmed).first();
    if (existing) return existing;

    const now = new Date().toISOString();
    const newTag: Tag = { id: uuid(), name: trimmed, color, createdAt: now, updatedAt: now };
    await db.tags.add(newTag);
    return newTag;
  };

  // Absent keys are left alone; a present `color: undefined` is the "no colour"
  // value and clears the field.
  const updateTag = async (id: string, changes: TagChanges) => {
    const tag = await db.tags.get(id);
    if (!tag) return null;

    const updatedTag: Tag = {
      ...tag,
      ...('name' in changes ? { name: changes.name?.trim() || tag.name } : {}),
      ...('color' in changes ? { color: changes.color } : {}),
      updatedAt: new Date().toISOString(),
    };
    await db.tags.put(updatedTag);
    return updatedTag;
  };

  const deleteTag = async (id: string) => {
    await db.transaction('rw', db.tags, db.noteTags, async () => {
      await db.tags.delete(id);
      await db.noteTags.where('tagId').equals(id).delete();
    });
  };

  /**
   * MERGE `source` into `target`: every note labelled `source` comes out
   * labelled `target`, and `source` is deleted. Notes that carried both keep
   * the one target link - the composite `[noteId+tagId]` key would reject a
   * blind re-link, so existing links are filtered out first.
   *
   * One transaction throughout: a half-applied merge would drop notes off both
   * tags at once.
   */
  const mergeTags = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    await db.transaction('rw', db.tags, db.noteTags, async () => {
      const target = await db.tags.get(targetId);
      if (!target) throw new Error(`Cannot merge into unknown tag ${targetId}`);

      const sourceLinks = await db.noteTags.where('tagId').equals(sourceId).toArray();
      const targetLinks = await db.noteTags.where('tagId').equals(targetId).toArray();
      const alreadyLinked = new Set(targetLinks.map((link) => link.noteId));

      const now = new Date().toISOString();
      await db.noteTags.bulkAdd(
        sourceLinks
          .filter((link) => !alreadyLinked.has(link.noteId))
          .map((link) => ({
            noteId: link.noteId,
            tagId: targetId,
            createdAt: link.createdAt,
            updatedAt: now,
          }))
      );

      await db.noteTags.where('tagId').equals(sourceId).delete();
      await db.tags.delete(sourceId);
    });
  };

  const addTagToNote = async (noteId: string, tagId: string) => {
    const exists = await db.noteTags.where({ noteId, tagId }).first();

    if (!exists) {
      const now = new Date().toISOString();
      await db.noteTags.add({ noteId, tagId, createdAt: now, updatedAt: now });
    }
  };

  const removeTagFromNote = async (noteId: string, tagId: string) => {
    await db.noteTags.where({ noteId, tagId }).delete();
  };

  return { createTag, updateTag, deleteTag, mergeTags, addTagToNote, removeTagFromNote };
}
