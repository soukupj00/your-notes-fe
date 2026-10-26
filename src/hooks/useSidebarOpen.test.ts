import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSidebarOpen } from './useSidebarOpen.ts';

/** A viewport whose width can change mid-test, as a rotation does. */
function stubWidth(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          const min = /min-width:\s*(\d+)px/.exec(query);
          return min ? width >= Number(min[1]) : false;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList
  );
  return (next: number) =>
    act(() => {
      width = next;
      for (const listener of listeners) listener();
    });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSidebarOpen', () => {
  it.each([
    [800, null, false],
    [1280, null, true],
    [800, 'true', true],
    [1280, 'false', false],
  ])('at %ipx with %s stored is %s', (width, stored, expected) => {
    stubWidth(width);
    if (stored !== null) localStorage.setItem('sidebar-open', stored);

    expect(renderHook(() => useSidebarOpen()).result.current[0]).toBe(expected);
  });

  it('follows a rotation until the user toggles, then keeps their choice', () => {
    const rotate = stubWidth(800);
    const { result } = renderHook(() => useSidebarOpen());
    expect(result.current[0]).toBe(false);

    rotate(1280);
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));
    rotate(800);
    rotate(1280);
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('sidebar-open')).toBe('false');
  });
});
