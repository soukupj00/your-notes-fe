import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import type { Tag } from '@/models.ts';

// Module-level, so a note with no id gets a Live that delivers once and never again:
const EMPTY = emptyLive<Tag[]>([]);

/**
 * A note's labels, live.
 *
 * `noteId` is nullable so a caller that already has the labels can skip the
 * query outright - the feed joins them on when it builds each entry, and running
 * this once per card would open a live query per card only to discard it.
 */
export function useTagsForNote(noteId: string | null | undefined): Tag[] {
  const store = useLocalStore();
  const tags = useLive(() => (noteId ? store.tags.forNote(noteId) : EMPTY), [store, noteId]);
  return tags ?? [];
}
