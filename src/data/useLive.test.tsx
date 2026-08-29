import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyLive, type Live } from './live.ts';
import { useLive } from './useLive.ts';

/** A hand-driven Live: the test decides when values arrive. */
function manual<T>() {
  const listeners = new Set<(value: T) => void>();
  const live: Live<T> = {
    subscribe(next) {
      listeners.add(next);
      return () => listeners.delete(next);
    },
  };
  return {
    live,
    emit: (value: T) =>
      listeners.forEach((l) => {
        l(value);
      }),
    size: () => listeners.size,
  };
}

describe('useLive', () => {
  it('is undefined until the first value arrives, then follows every emission', () => {
    const source = manual<number>();
    const { result } = renderHook(() => useLive(() => source.live, []));
    expect(result.current).toBeUndefined();
    act(() => source.emit(1));
    expect(result.current).toBe(1);
    act(() => source.emit(2));
    expect(result.current).toBe(2);
  });

  it('unsubscribes on unmount', () => {
    const source = manual<number>();
    const { unmount } = renderHook(() => useLive(() => source.live, []));
    expect(source.size()).toBe(1);
    unmount();
    expect(source.size()).toBe(0);
  });

  it('re-subscribes when a dep changes and keeps the last value meanwhile', () => {
    const a = manual<string>();
    const b = manual<string>();
    const { result, rerender } = renderHook(
      ({ which }) => useLive(() => (which === 'a' ? a.live : b.live), [which]),
      {
        initialProps: { which: 'a' },
      }
    );
    act(() => a.emit('from a'));
    rerender({ which: 'b' });
    expect(a.size()).toBe(0);
    expect(b.size()).toBe(1);
    // The previous value is kept rather than flashing to undefined: the feed
    // would otherwise show skeletons on every route change.
    expect(result.current).toBe('from a');
    act(() => b.emit('from b'));
    expect(result.current).toBe('from b');
  });
});

describe('emptyLive', () => {
  it('delivers its value once, asynchronously', async () => {
    const live = emptyLive('none');
    const values: string[] = [];
    live.subscribe((value) => values.push(value));

    expect(values).toEqual([]); // not synchronous
    await waitFor(() => expect(values).toEqual(['none']));
  });

  it('does not deliver after unsubscribe', async () => {
    const live = emptyLive('none');
    const values: string[] = [];
    const unsubscribe = live.subscribe((value) => values.push(value));

    unsubscribe();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(values).toEqual([]);
  });
});
