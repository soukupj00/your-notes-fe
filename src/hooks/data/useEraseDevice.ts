import { useLocalStore } from '@/data/LocalStoreProvider.tsx';

/** The last step of a sign-out: ask `useSync().owes()` first, or what was not synced is lost. */
export function useEraseDevice(): () => Promise<void> {
  const store = useLocalStore();
  return () => store.clear();
}
