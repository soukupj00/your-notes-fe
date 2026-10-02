import { type RenderHookOptions, render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';

/**
 * Dexie on the `fake-indexeddb` that `setup.ts` installs, so tests run the code path users run.
 * A test that never needs a Blob may build a `createMemoryLocalStore()` instead.
 */
export const testStore = createDexieLocalStore();

export const clearStore = () => testStore.clear();

export function withStore(ui: ReactNode) {
  return <LocalStoreProvider store={testStore}>{ui}</LocalStoreProvider>;
}

export function renderWithStore(ui: ReactElement) {
  return render(withStore(ui));
}

export function renderHookWithStore<T, P = void>(
  hook: (props: P) => T,
  options?: Omit<RenderHookOptions<P>, 'wrapper'>
) {
  return renderHook(hook, {
    ...options,
    wrapper: ({ children }) => (
      <LocalStoreProvider store={testStore}>{children}</LocalStoreProvider>
    ),
  });
}
