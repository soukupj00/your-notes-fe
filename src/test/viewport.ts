import { vi } from 'vitest';

/**
 * Put a test in a viewport: a width for the layout queries, a pointer for the
 * affordance ones (ADR 0016).
 *
 * jsdom evaluates no media query at all - `matchMedia` answers `false` to
 * everything, whatever `window.innerWidth` says - so setting the width alone
 * stopped being enough the moment `useIsMobile` started reading the query
 * instead of re-measuring the window. Reading the query is the point: it is the
 * signal the stylesheet uses, so JS and CSS cannot disagree.
 *
 * The pointer follows the width by default, which is the common case a test
 * means (a 1024px window is a desktop with a mouse; a 360px one is a phone).
 * Pass it explicitly for the two devices that break the correlation - a
 * touchscreen laptop, and a phone held sideways.
 */
export function setViewport(width: number, { finePointer = width >= 640 } = {}) {
  window.innerWidth = width;
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = max
      ? width <= Number(max[1])
      : min
        ? width >= Number(min[1])
        : query.includes('pointer: fine')
          ? finePointer
          : false;
    return {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
  });
}
