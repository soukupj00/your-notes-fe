import { useTranslation } from 'react-i18next';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import {
  type ArrangeKind,
  arrangedOrder,
  labelCollator,
  positionForMove,
  positionForNew,
  positionsInOrder,
  sortLabels,
} from '@/lib/label-order.ts';
import { newNoteTag, newTag, nowIso } from '@/lib/rows.ts';

/** The fields a user can edit on a Tag. An explicit `color: undefined` clears it. */
export type TagChanges = {
  name?: string;
  color?: string;
};

export function useTagActions() {
  const store = useLocalStore();
  const { i18n } = useTranslation();
  const collator = () => labelCollator(i18n.language);
  const ordered = async () => sortLabels(await store.tags.list(), collator());

  /**
   * Returns the existing tag when the name is taken, case-insensitively: create-on-the-fly runs
   * from a free-text field, so typing "work" must not mint a second "Work".
   */
  const createTag = async (name: string, color?: string) => {
    const trimmed = name.trim();
    const existing = await store.tags.findByName(trimmed);
    if (existing) return existing;

    const position = positionForNew(trimmed, await ordered(), collator());
    const tag = { ...newTag(trimmed, color), ...(position && { position }) };
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

  const moveTag = async (activeId: string, overId: string) => {
    const positions = positionForMove(await ordered(), activeId, overId);
    if (positions.size > 0) await store.tags.setPositions(positions);
  };

  /** Rewrites every position once, and returns the undo, which puts back none where there was none. */
  const arrangeTags = async (kind: ArrangeKind) => {
    const tags = await ordered();
    const previous = new Map(tags.map((tag) => [tag.id, tag.position ?? null]));
    await store.tags.setPositions(positionsInOrder(arrangedOrder(tags, kind, collator())));
    return () => store.tags.setPositions(previous);
  };

  const addTagToNote = (noteId: string, tagId: string) =>
    store.tags.link(newNoteTag(noteId, tagId));

  const removeTagFromNote = (noteId: string, tagId: string) => store.tags.unlink(noteId, tagId);

  return {
    createTag,
    updateTag,
    deleteTag,
    mergeTags,
    moveTag,
    arrangeTags,
    addTagToNote,
    removeTagFromNote,
  };
}
