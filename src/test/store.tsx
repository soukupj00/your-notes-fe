import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';

/**
 * The store every test renders against: the Dexie implementation on the
 * `fake-indexeddb` that `setup.ts` installs, so tests exercise the code path
 * users run. A test that only needs a store and never a Blob may build a
 * `createMemoryLocalStore()` of its own instead.
 */
export const testStore = createDexieLocalStore();

/** Empties every store between tests. */
export const clearStore = () => testStore.clear();

export function withStore(ui: ReactNode) {
  return <LocalStoreProvider store={testStore}>{ui}</LocalStoreProvider>;
}

export function renderWithStore(ui: ReactElement) {
  return render(withStore(ui));
}

export function renderHookWithStore<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <LocalStoreProvider store={testStore}>{children}</LocalStoreProvider>
    ),
  });
}
