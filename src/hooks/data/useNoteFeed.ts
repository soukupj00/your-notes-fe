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
 * Pinned notes head the feed under any sort or search, in pin order rather than the sort:
 * the user arranged that shelf by pinning, so sorting by title must not reshuffle it.
 */
function floatPinned(notes: Note[]): Note[] {
  const pinned = notes.filter((note) => note.pinnedAt).sort(byPinnedAt);
  if (pinned.length === 0) return notes;
  return [...pinned, ...notes.filter((note) => !note.pinnedAt)];
}

/** Stable empties, so a render that has neither does not invalidate a memo. */
const EMPTY_NOTES: Note[] = [];
const EMPTY_IDS: readonly string[] = [];

function sameOrder(ids: readonly string[], notes: readonly Note[]): boolean {
  return ids.length === notes.length && ids.every((id, index) => id === notes[index].id);
}

/**
 * Counts the times the document became visible again, so returning to the tab re-ranks the wall
 * (ADR 0012). A PWA tab stays open for days; without it the held order would go stale.
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
 * Counts the editor closing: the user was in the Note, not on the wall, so the Note they just
 * edited may take its sorted place then (feedback B4). Opening re-ranks nothing.
 */
function useCloseEpoch(editing: boolean): number {
  const [seen, setSeen] = useState({ editing, epoch: 0 });
  if (seen.editing !== editing) {
    setSeen({ editing, epoch: editing ? seen.epoch : seen.epoch + 1 });
  }
  return seen.epoch;
}

/**
 * The one live query behind every note list: scope, then search within it (so Trash is only
 * reachable from `/trash`, ADR 0009), then order. Membership is live, rank is held (ADR 0012);
 * the full design is in src/hooks/data/CLAUDE.md.
 */
export function useNoteFeed(scope: NoteFeedScope, search?: NoteSearchParams) {
  const { q, sort, dir, tags } = resolveNoteSearch(search);
  const trimmed = q.trim();
  // Arrays are fresh objects on every render; the joined key is what the memos
  // can actually compare.
  const tagKey = tags.join(',');
  const visibilityEpoch = useVisibilityEpoch();
  const closeEpoch = useCloseEpoch(Boolean(search?.note));

  const store = useLocalStore();
  const notesInScope = useLive(() => store.notes.feed(scope), [store, scope.state, scope.tagId]);

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
  const rankKey = `${scope.state}|${scope.tagId ?? ''}|${trimmed}|${sort}|${dir}|${tagKey}|${visibilityEpoch}|${closeEpoch}`;

  // The freshly sorted feed, before any memory of what was last shown.
  const fresh = useMemo(() => {
    if (!entries) return EMPTY_NOTES;
    const matched = trimmed
      ? searchNotes(index, trimmed)
      : entries.map((entry) => entry.note).sort(comparatorFor(sort, dir));
    return allowedIds ? matched.filter((note) => allowedIds.has(note.id)) : matched;
  }, [entries, index, trimmed, sort, dir, allowedIds]);

  // State, not a ref, because it is read during render. Tagged with its `rankKey` so a stale order
  // is spotted at read time; a reset effect would run after the memo it must precede.
  const [held, setHeld] = useState<{ key: string; ids: readonly string[] } | null>(null);
  const heldIds = held?.key === rankKey ? held.ids : EMPTY_IDS;

  const ranked = useMemo(() => mergeHeldOrder(fresh, heldIds), [fresh, heldIds]);

  // Recorded before `floatPinned`, so an unpin puts the note back (ADR 0012's one exception). Set
  // during render, React's derive-state pattern, so the unstable order never paints; the equality
  // check is what stops it re-triggering forever.
  if (!sameOrder(heldIds, ranked) || held?.key !== rankKey) {
    setHeld({ key: rankKey, ids: ranked.map((note) => note.id) });
  }

  const notes = useMemo(() => floatPinned(ranked), [ranked]);

  // `undefined` means the live query has not resolved yet; surface that as
  // `loading` so views show skeletons instead of a false empty state.
  return { notes, loading: entries === undefined };
}
