import { v4 as uuid } from 'uuid';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { Tag } from '@/models.ts';

/** The fields a user can edit on a Tag. An explicit `color: undefined` clears it. */
export type TagChanges = {
  name?: string;
  color?: string;
};

export function useTagActions() {
  const store = useLocalStore();

  /**
   * CREATE a tag, or return the existing one when the name is already taken.
   * Names are compared case-insensitively: create-on-the-fly runs from a free
   * text field, so typing "work" must not mint a second copy of "Work".
   */
  const createTag = async (name: string, color?: string) => {
    const trimmed = name.trim();
    const existing = await store.tags.findByName(trimmed);
    if (existing) return existing;

    const now = new Date().toISOString();
    const newTag: Tag = { id: uuid(), name: trimmed, color, createdAt: now, updatedAt: now };
    await store.tags.add(newTag);
    return newTag;
  };

  // Absent keys are left alone; a present `color: undefined` is the "no colour"
  // value and clears the field.
  const updateTag = async (id: string, changes: TagChanges) => {
    const tag = await store.tags.get(id);
    if (!tag) return null;

    const updatedTag: Tag = {
      ...tag,
      ...('name' in changes ? { name: changes.name?.trim() || tag.name } : {}),
      ...('color' in changes ? { color: changes.color } : {}),
      updatedAt: new Date().toISOString(),
    };
    await store.tags.put(updatedTag);
    return updatedTag;
  };

  const deleteTag = (id: string) => store.tags.delete(id);

  /**
   * MERGE `source` into `target`: every note labelled `source` comes out
   * labelled `target`, and `source` is deleted. Notes that carried both keep
   * the one target link - the composite `[noteId+tagId]` key would reject a
   * blind re-link, so existing links are filtered out first. The self-merge
   * no-op guard lives in the store.
   *
   * One transaction throughout: a half-applied merge would drop notes off both
   * tags at once.
   */
  const mergeTags = (sourceId: string, targetId: string) => store.tags.merge(sourceId, targetId);

  const addTagToNote = async (noteId: string, tagId: string) => {
    const now = new Date().toISOString();
    await store.tags.link({ noteId, tagId, createdAt: now, updatedAt: now });
  };

  const removeTagFromNote = (noteId: string, tagId: string) => store.tags.unlink(noteId, tagId);

  return { createTag, updateTag, deleteTag, mergeTags, addTagToNote, removeTagFromNote };
}
