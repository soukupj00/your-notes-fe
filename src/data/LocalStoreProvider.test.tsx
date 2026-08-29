import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LocalStoreProvider, useLocalStore } from './LocalStoreProvider.tsx';
import { createMemoryLocalStore } from './memory/MemoryLocalStore.ts';

describe('LocalStoreProvider', () => {
  it('hands the configured store to useLocalStore', () => {
    const store = createMemoryLocalStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocalStoreProvider store={store}>{children}</LocalStoreProvider>
    );
    const { result } = renderHook(() => useLocalStore(), { wrapper });
    expect(result.current).toBe(store);
  });

  it('throws outside a provider, because a silent default would be a second store', () => {
    expect(() => renderHook(() => useLocalStore())).toThrow(/LocalStoreProvider/);
  });
});
