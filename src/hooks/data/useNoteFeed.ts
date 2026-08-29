import { useEffect, useMemo, useState } from 'react';
import type { NoteFeedScope } from '@/data/LocalStore.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';
import { mergeHeldOrder } from '@/lib/feed-rank.ts';
import { createNoteSearchIndex, type NoteSearchEntry, searchNotes } from '@/lib/note-search.ts';
import {
  type NoteSearchParams,
  type NoteSortDirection,
  type NoteSortField,
  resolveNoteSearch,
} from '@/lib/note-search-params.ts';
import type { Note } from '@/models.ts';

export type { NoteFeedScope } from '@/data/LocalStore.ts';

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

/** Stable empties, so a render that has neither does not invalidate a memo. */
const EMPTY_NOTES: Note[] = [];
const EMPTY_IDS: readonly string[] = [];

/** Whether a stored order still describes this list, position for position. */
function sameOrder(ids: readonly string[], notes: readonly Note[]): boolean {
  return ids.length === notes.length && ids.every((id, index) => id === notes[index].id);
}

/**
 * Counts the times the document has become visible again.
 *
 * Folded into the rank key so returning to a backgrounded tab re-ranks the wall
 * (ADR 0012). It is the one "the user is not watching" signal a route change
 * cannot supply: a PWA tab stays open for days, so without it the held order
 * would go stale for as long as the tab lives.
 */
function useVisibilityEpoch(): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setEpoch((previous) => previous + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return epoch;
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
 *
 * **Membership is live, rank is held** (ADR 0012). A live query refires for
 * *any* write to the notes table, and every mutation bumps `updatedAt`, so on
 * the default `updated desc` sort the wall would re-order itself the instant
 * the user recoloured a card, ticked a checkbox, or typed in the open editor.
 * Notes still join and leave the feed at once; what is held is where the ones
 * already on screen sit. The order is re-taken only when the user is not
 * watching: on mount, on a search-param change, and on returning to the tab.
 */
export function useNoteFeed(scope: NoteFeedScope, search?: NoteSearchParams) {
  const { q, sort, dir, tags } = resolveNoteSearch(search);
  const trimmed = q.trim();
  // Arrays are fresh objects on every render; the joined key is what the memos
  // can actually compare.
  const tagKey = tags.join(',');
  const visibilityEpoch = useVisibilityEpoch();

  const store = useLocalStore();
  const notesInScope = useLive(() => store.notes.feed(scope), [store, scope.state, scope.tagId]);

  // A note's tags ride along with it from the store: the index needs their
  // names at build time, and the pill filters need their ids.
  const entries = useMemo(
    () =>
      notesInScope?.map<FeedEntry>((note) => ({
        note,
        tagIds: (note.tags ?? []).map((tag) => tag.id),
        tagNames: (note.tags ?? []).map((tag) => tag.name),
      })),
    [notesInScope]
  );

  // Filtering by tag before the index is built would rebuild it on every pill
  // toggle; filtering the *results* keeps the index tied to the scope alone
  // and preserves relevance order.
  const index = useMemo(() => createNoteSearchIndex(entries ?? []), [entries]);

  const required = useMemo(() => (tagKey ? tagKey.split(',') : []), [tagKey]);

  const allowedIds = useMemo(() => {
    if (!entries || required.length === 0) return null;
    // Multi-tag is AND: the note must carry every selected label.
    return new Set(
      entries.flatMap((entry) =>
        required.every((tagId) => entry.tagIds.includes(tagId)) ? [entry.note.id] : []
      )
    );
  }, [entries, required]);

  // Everything the user can ask for a *different* order with. A change here is
  // the user looking away or asking to be re-ranked, so the held order is
  // abandoned and the fresh one adopted (ADR 0012).
  const rankKey = `${scope.state}|${scope.tagId ?? ''}|${trimmed}|${sort}|${dir}|${tagKey}|${visibilityEpoch}`;

  // The freshly sorted feed, before any memory of what was last shown.
  const fresh = useMemo(() => {
    if (!entries) return EMPTY_NOTES;
    const matched = trimmed
      ? searchNotes(index, trimmed)
      : entries.map((entry) => entry.note).sort(comparatorFor(sort, dir));
    return allowedIds ? matched.filter((note) => allowedIds.has(note.id)) : matched;
  }, [entries, index, trimmed, sort, dir, allowedIds]);

  // State rather than a ref: the order last shown has to be *read* while
  // rendering, and a ref may be neither read nor written during render.
  // Tagged with the params it was captured under, so a stale order is
  // recognised at read time rather than through a reset effect that would run
  // after the memo it is meant to precede.
  const [held, setHeld] = useState<{ key: string; ids: readonly string[] } | null>(null);
  const heldIds = held?.key === rankKey ? held.ids : EMPTY_IDS;

  const ranked = useMemo(() => mergeHeldOrder(fresh, heldIds), [fresh, heldIds]);

  // Recorded *before* pinning, which is what keeps pinning live (ADR 0012's one
  // exception). Holding the post-float order instead would pin a note to the
  // front permanently: unpinning it would find it already at rank 0 and leave
  // it there, so the pin could never be taken back.
  //
  // Adjusted during render rather than from an effect. This is React's
  // documented way to derive state from a changed input: the re-render happens
  // before anything commits, so it costs a second pass rather than a second
  // paint - where an effect would setState after committing and show the
  // unstable order for a frame first.
  //
  // The equality check is what terminates it. Storing the order feeds straight
  // back into the memo that produced it, so without bailing out on an unchanged
  // result the two would re-trigger each other forever.
  if (!sameOrder(heldIds, ranked) || held?.key !== rankKey) {
    setHeld({ key: rankKey, ids: ranked.map((note) => note.id) });
  }

  const notes = useMemo(() => floatPinned(ranked), [ranked]);

  // `undefined` means the live query has not resolved yet; surface that as
  // `loading` so views show skeletons instead of a false empty state.
  return { notes, loading: entries === undefined };
}
