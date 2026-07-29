import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db.ts';
import { createNoteSearchIndex, type NoteSearchEntry, searchNotes } from '@/lib/note-search.ts';
import type { Note, NoteState } from '@/models.ts';

/**
 * Which slice of the library a view is showing. `state` maps one-to-one onto a
 * route (`/` → active, `/archive` → archived, `/trash` → trashed); `tagId`
 * narrows it further for `/tag/$id`.
 */
export type NoteFeedScope = {
  state: NoteState;
  tagId?: string;
};

/**
 * Feed ordering: pinned notes float to the top, newest pin first, then
 * everything else by most-recently-updated. Pins only exist on active notes,
 * so archive/trash fall through to plain recency.
 */
function byFeedOrder(a: Note, b: Note) {
  if (a.pinnedAt && !b.pinnedAt) return -1;
  if (!a.pinnedAt && b.pinnedAt) return 1;
  if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt);
  return b.updatedAt.localeCompare(a.updatedAt);
}

/**
 * The single reactive query behind every note list. Scope first (state, and
 * optionally a tag), then the search text, then ordering.
 *
 * Search is applied *within* the current scope, so a query on `/archive`
 * searches the archive. Trashed notes are therefore never searchable from a
 * normal view - they are only reachable from `/trash` itself (ADR 0009).
 *
 * The live query depends on the *scope* only; the query text is applied
 * afterwards against a memoised Fuse index, so typing re-scores in memory
 * instead of re-hitting IndexedDB and rebuilding the index per keystroke.
 */
export function useNoteFeed(scope: NoteFeedScope, query = '') {
  const trimmed = query.trim();

  const entries = useLiveQuery(async () => {
    let candidates = await db.notes.where('state').equals(scope.state).toArray();

    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((link) => link.noteId));
      candidates = candidates.filter((note) => inTag.has(note.id));
    }

    // Tag names ride along with the notes: a note is findable by its labels,
    // and the index needs them at build time rather than per search.
    const [tags, links] = await Promise.all([db.tags.toArray(), db.noteTags.toArray()]);
    const nameById = new Map(tags.map((tag) => [tag.id, tag.name]));
    const namesByNote = new Map<string, string[]>();
    for (const link of links) {
      const name = nameById.get(link.tagId);
      if (!name) continue;
      const existing = namesByNote.get(link.noteId);
      if (existing) existing.push(name);
      else namesByNote.set(link.noteId, [name]);
    }

    return candidates.map<NoteSearchEntry>((note) => ({
      note,
      tagNames: namesByNote.get(note.id) ?? [],
    }));
  }, [scope.state, scope.tagId]);

  const index = useMemo(() => createNoteSearchIndex(entries ?? []), [entries]);

  const notes = useMemo(() => {
    if (!entries) return [];
    if (!trimmed) return entries.map((entry) => entry.note).sort(byFeedOrder);
    return searchNotes(index, trimmed);
  }, [entries, index, trimmed]);

  // `undefined` means the live query has not resolved yet; surface that as
  // `loading` so views show skeletons instead of a false empty state.
  return { notes, loading: entries === undefined };
}
