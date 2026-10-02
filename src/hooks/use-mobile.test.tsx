import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsMobile } from './use-mobile.tsx';

/**
 * A `MediaQueryList` whose `matches` a test can flip, so the query and `window.innerWidth` can
 * disagree: the state a phone passes through on rotation, and the only one the bug shows in.
 */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  return {
    set(matches: boolean) {
      mql.matches = matches;
      act(() => {
        for (const fn of listeners) fn();
      });
    },
  };
}

describe('useIsMobile', () => {
  const realMatchMedia = window.matchMedia;
  const realWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    Object.defineProperty(window, 'innerWidth', { value: realWidth, configurable: true });
  });

  it('follows the media query when the window has not caught up yet', () => {
    // A phone in landscape: 844px wide, so the query says "wide" and agrees.
    Object.defineProperty(window, 'innerWidth', { value: 844, configurable: true });
    const query = stubMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Rotated to portrait: the query has changed, but `innerWidth` is still
    // reporting the landscape width. Reading the window here would answer
    // `false` and never be asked again.
    query.set(true);

    expect(result.current).toBe(true);
  });
});
