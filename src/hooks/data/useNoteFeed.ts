import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import { stripHtml } from '@/lib/utils.ts';
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

function matchesText(note: Note, lowerQuery: string) {
  return (
    !!note.header?.toLowerCase().includes(lowerQuery) ||
    !!note.description?.toLowerCase().includes(lowerQuery) ||
    stripHtml(note.body).toLowerCase().includes(lowerQuery) ||
    note.createdAt.toLowerCase().includes(lowerQuery) ||
    note.updatedAt.toLowerCase().includes(lowerQuery)
  );
}

/**
 * The single reactive query behind every note list. Scope first (state, and
 * optionally a tag), then the search text, then feed ordering.
 *
 * Search is applied *within* the current scope, so a query on `/archive`
 * searches the archive. Trashed notes are therefore never searchable from a
 * normal view - they are only reachable from `/trash` itself (ADR 0009).
 *
 * Matching is a linear in-memory scan, as before: correct and simple at
 * local-first scale, and the `state` index already cuts the candidate set.
 */
export function useNoteFeed(scope: NoteFeedScope, query = '') {
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  const notes = useLiveQuery(async () => {
    let candidates = await db.notes.where('state').equals(scope.state).toArray();

    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((link) => link.noteId));
      candidates = candidates.filter((note) => inTag.has(note.id));
    }

    if (trimmed) {
      // A note also matches when one of *its* tags matches the query, which is
      // why the tag lookup happens even for a plain text search.
      const matchingTags = await db.tags
        .filter((tag) => tag.name.toLowerCase().includes(lowerQuery))
        .toArray();
      const taggedNoteIds = new Set<string>();
      if (matchingTags.length > 0) {
        const tagIds = new Set(matchingTags.map((tag) => tag.id));
        const links = await db.noteTags.filter((link) => tagIds.has(link.tagId)).toArray();
        for (const link of links) taggedNoteIds.add(link.noteId);
      }
      candidates = candidates.filter(
        (note) => matchesText(note, lowerQuery) || taggedNoteIds.has(note.id)
      );
    }

    return candidates.sort(byFeedOrder);
  }, [scope.state, scope.tagId, trimmed]);

  // `undefined` means the live query has not resolved yet; surface that as
  // `loading` so views show skeletons instead of a false empty state.
  return { notes: notes ?? [], loading: notes === undefined };
}
