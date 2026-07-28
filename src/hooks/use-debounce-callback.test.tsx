import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebounceCallback } from './use-debounce-callback';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounceCallback', () => {
  it('tracks and controls the same pending invocation returned by the hook', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 100));

    act(() => {
      void result.current.invoke('value');
    });
    expect(result.current.isPending()).toBe(true);

    act(() => result.current.flush());
    expect(callback).toHaveBeenCalledWith('value');
    expect(result.current.isPending()).toBe(false);
  });

  it('cancels pending work when unmounted', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebounceCallback(callback, 100));

    act(() => {
      void result.current.invoke();
    });
    unmount();
    act(() => {
      void vi.runAllTimers();
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
