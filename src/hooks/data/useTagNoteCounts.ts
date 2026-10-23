import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';

const NONE: Record<string, number> = {};

export function useTagNoteCounts(): Record<string, number> {
  const store = useLocalStore();
  return useLive(() => store.tags.noteCounts(), [store]) ?? NONE;
}
