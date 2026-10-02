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
   * Returns the existing tag when the name is taken, case-insensitively: create-on-the-fly runs
   * from a free-text field, so typing "work" must not mint a second "Work".
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
   * Relabels every `source` note as `target` and deletes `source`, in one store transaction:
   * a half-applied merge would drop notes off both tags.
   */
  const mergeTags = (sourceId: string, targetId: string) => store.tags.merge(sourceId, targetId);

  const addTagToNote = async (noteId: string, tagId: string) => {
    const now = new Date().toISOString();
    await store.tags.link({ noteId, tagId, createdAt: now, updatedAt: now });
  };

  const removeTagFromNote = (noteId: string, tagId: string) => store.tags.unlink(noteId, tagId);

  return { createTag, updateTag, deleteTag, mergeTags, addTagToNote, removeTagFromNote };
}
