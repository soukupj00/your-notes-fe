import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import type { Tag } from '@/models.ts';

// Module-level, so a note with no id gets a Live that delivers once and never again.
const EMPTY = emptyLive<Tag[]>([]);

/**
 * `noteId` is nullable so a caller that already has the labels skips the query: the feed joins
 * them on, and running this per card would open a live query per card only to discard it.
 */
export function useTagsForNote(noteId: string | null | undefined): Tag[] {
  const store = useLocalStore();
  const tags = useLive(() => (noteId ? store.tags.forNote(noteId) : EMPTY), [store, noteId]);
  return tags ?? [];
}
