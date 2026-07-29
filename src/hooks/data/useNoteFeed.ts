import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db.ts';
import { createNoteSearchIndex, type NoteSearchEntry, searchNotes } from '@/lib/note-search.ts';
import {
  type NoteSearchParams,
  type NoteSortDirection,
  type NoteSortField,
  resolveNoteSearch,
} from '@/lib/note-search-params.ts';
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

/** A scoped note with the tag data the feed needs to search and filter it. */
type FeedEntry = NoteSearchEntry & { tagIds: string[] };

/** Newest pin first - the pinned shelf keeps its own order (see `floatPinned`). */
function byPinnedAt(a: Note, b: Note) {
  return (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? '');
}

function comparatorFor(sort: NoteSortField, dir: NoteSortDirection) {
  const sign = dir === 'asc' ? -1 : 1;
  return (a: Note, b: Note) => {
    switch (sort) {
      case 'created':
        return sign * b.createdAt.localeCompare(a.createdAt);
      case 'title':
        // Titles read alphabetically, so 'asc' must mean A→Z: the sign flips
        // relative to the date sorts, where 'desc' (newest first) is natural.
        return (
          -sign *
          (a.header ?? '').localeCompare(b.header ?? '', undefined, {
            sensitivity: 'base',
          })
        );
      default:
        return sign * b.updatedAt.localeCompare(a.updatedAt);
    }
  };
}

/**
 * Pinned notes always head the feed, whatever the sort or the search ranking -
 * a pin is the user saying "keep this in front of me". Within the shelf they
 * stay in pin order (newest pin first) rather than adopting the sort: sorting
 * by title should not reshuffle a shelf the user arranged by pinning.
 */
function floatPinned(notes: Note[]): Note[] {
  const pinned = notes.filter((note) => note.pinnedAt).sort(byPinnedAt);
  if (pinned.length === 0) return notes;
  return [...pinned, ...notes.filter((note) => !note.pinnedAt)];
}

/**
 * The single reactive query behind every note list. Scope first (state, and
 * optionally a tag), then the search text, then ordering.
 *
 * Search is applied *within* the current scope, so a query on `/archive`
 * searches the archive. Trashed notes are therefore never searchable from a
 * normal view - they are only reachable from `/trash` itself (ADR 0009).
 *
 * The live query depends on the *scope* only; the search state (text, sort,
 * tag filters) is applied afterwards against a memoised Fuse index, so typing
 * or toggling a filter re-scores in memory instead of re-hitting IndexedDB and
 * rebuilding the index.
 */
export function useNoteFeed(scope: NoteFeedScope, search?: NoteSearchParams) {
  const { q, sort, dir, tags } = resolveNoteSearch(search);
  const trimmed = q.trim();
  // Arrays are fresh objects on every render; the joined key is what the memos
  // can actually compare.
  const tagKey = tags.join(',');

  const entries = useLiveQuery(async () => {
    let candidates = await db.notes.where('state').equals(scope.state).toArray();

    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((link) => link.noteId));
      candidates = candidates.filter((note) => inTag.has(note.id));
    }

    // A note's tags ride along with it: the index needs their names at build
    // time, and the pill filters need their ids.
    const [allTags, links] = await Promise.all([db.tags.toArray(), db.noteTags.toArray()]);
    const nameById = new Map(allTags.map((tag) => [tag.id, tag.name]));
    const linksByNote = new Map<string, string[]>();
    for (const link of links) {
      if (!nameById.has(link.tagId)) continue;
      const existing = linksByNote.get(link.noteId);
      if (existing) existing.push(link.tagId);
      else linksByNote.set(link.noteId, [link.tagId]);
    }

    return candidates.map<FeedEntry>((note) => {
      const tagIds = linksByNote.get(note.id) ?? [];
      return { note, tagIds, tagNames: tagIds.map((id) => nameById.get(id) ?? '') };
    });
  }, [scope.state, scope.tagId]);

  // Filtering by tag before the index is built would rebuild it on every pill
  // toggle; filtering the *results* keeps the index tied to the scope alone
  // and preserves relevance order.
  const index = useMemo(() => createNoteSearchIndex(entries ?? []), [entries]);

  const required = useMemo(() => (tagKey ? tagKey.split(',') : []), [tagKey]);

  const allowedIds = useMemo(() => {
    if (!entries || required.length === 0) return null;
    // Multi-tag is AND: the note must carry every selected label.
    return new Set(
      entries
        .filter((entry) => required.every((tagId) => entry.tagIds.includes(tagId)))
        .map((entry) => entry.note.id)
    );
  }, [entries, required]);

  const notes = useMemo(() => {
    if (!entries) return [];
    const matched = trimmed
      ? searchNotes(index, trimmed)
      : entries.map((entry) => entry.note).sort(comparatorFor(sort, dir));
    const filtered = allowedIds ? matched.filter((note) => allowedIds.has(note.id)) : matched;
    return floatPinned(filtered);
  }, [entries, index, trimmed, sort, dir, allowedIds]);

  // `undefined` means the live query has not resolved yet; surface that as
  // `loading` so views show skeletons instead of a false empty state.
  return { notes, loading: entries === undefined };
}
