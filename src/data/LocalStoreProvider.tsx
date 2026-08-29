import { createContext, type ReactNode, useContext } from 'react';
import type { LocalStore } from './LocalStore.ts';

const LocalStoreContext = createContext<LocalStore | undefined>(undefined);

/**
 * Hands the one Local Store to the tree (ADR 0020). Composed once, in
 * `main.tsx`: which implementation runs is a build-time decision made by
 * whoever deploys the app, never a runtime switch.
 */
export function LocalStoreProvider({
  store,
  children,
}: {
  store: LocalStore;
  children: ReactNode;
}) {
  return <LocalStoreContext.Provider value={store}>{children}</LocalStoreContext.Provider>;
}

export function useLocalStore(): LocalStore {
  const store = useContext(LocalStoreContext);
  if (!store) throw new Error('useLocalStore must be used within a LocalStoreProvider');
  return store;
}
