import { noteTagId } from '@/contract/index.ts';
import type { NoteTag, Tag } from '@/models.ts';

// Helpers both Local Store implementations share for `importAll` (ADR 0019).

const nameKey = (tag: Tag) => tag.name.trim().toLowerCase();

/**
 * The imported Tags the store does not hold, and the links pointed at the Tags it ends up with.
 * A held Tag stands for an imported one with its id, else with its name, ignoring case.
 */
export function matchImport(
  imported: { tags: readonly Tag[]; noteTags: readonly NoteTag[] },
  held: readonly Tag[]
): { tags: Tag[]; noteTags: NoteTag[] } {
  const heldIds = new Set(held.map((tag) => tag.id));
  const idByName = new Map(held.map((tag) => [nameKey(tag), tag.id]));
  const standIn = new Map<string, string>();
  const tags: Tag[] = [];

  for (const tag of imported.tags) {
    if (heldIds.has(tag.id)) continue;
    const named = idByName.get(nameKey(tag));
    if (named) {
      standIn.set(tag.id, named);
      continue;
    }
    idByName.set(nameKey(tag), tag.id);
    tags.push(tag);
  }

  // Keyed, because two imported Tags can stand for one held Tag on the same Note.
  const links = new Map<string, NoteTag>();
  for (const link of imported.noteTags) {
    const tagId = standIn.get(link.tagId) ?? link.tagId;
    links.set(noteTagId(link.noteId, tagId), { ...link, tagId });
  }
  return { tags, noteTags: [...links.values()] };
}
