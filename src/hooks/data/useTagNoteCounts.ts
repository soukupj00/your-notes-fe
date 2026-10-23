import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';

const NONE: Record<string, number> = {};

/** Per label id, how many of its Notes are not in the trash; a label with none is absent. */
export function useTagNoteCounts(): Record<string, number> {
  const store = useLocalStore();
  return useLive(() => store.tags.noteCounts(), [store]) ?? NONE;
}
