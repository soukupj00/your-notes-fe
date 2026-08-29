import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';
import type { Tag } from '@/models.ts';

export function useTags(): Tag[] {
  const store = useLocalStore();
  return useLive(() => store.tags.all(), [store]) ?? [];
}
