import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { newNoteTag, newTag, nowIso } from '@/lib/rows.ts';

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

    const tag = newTag(trimmed, color);
    await store.tags.add(tag);
    return tag;
  };

  const updateTag = (id: string, changes: TagChanges) =>
    store.tags.update(id, (tag) => ({
      ...('name' in changes ? { name: changes.name?.trim() || tag.name } : {}),
      ...('color' in changes ? { color: changes.color } : {}),
      updatedAt: nowIso(),
    }));

  const deleteTag = (id: string) => store.tags.delete(id);

  /**
   * Relabels every `source` note as `target` and deletes `source`, in one store transaction:
   * a half-applied merge would drop notes off both tags.
   */
  const mergeTags = (sourceId: string, targetId: string) => store.tags.merge(sourceId, targetId);

  const addTagToNote = (noteId: string, tagId: string) =>
    store.tags.link(newNoteTag(noteId, tagId));

  const removeTagFromNote = (noteId: string, tagId: string) => store.tags.unlink(noteId, tagId);

  return { createTag, updateTag, deleteTag, mergeTags, addTagToNote, removeTagFromNote };
}
