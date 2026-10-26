import { vi } from 'vitest';

/**
 * A width for the layout queries and a pointer for the affordance ones (ADR 0016). jsdom's
 * `matchMedia` answers `false` to everything, so setting the width alone is not enough.
 * Pass `finePointer` for a touchscreen laptop or a phone held sideways, and `anyFinePointer` for
 * a touch primary with a trackpad beside it.
 */
export function setViewport(
  width: number,
  {
    finePointer = width >= 640,
    anyFinePointer = finePointer,
  }: { finePointer?: boolean; anyFinePointer?: boolean } = {}
) {
  window.innerWidth = width;
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = max
      ? width <= Number(max[1])
      : min
        ? width >= Number(min[1])
        : query.includes('any-pointer: fine')
          ? anyFinePointer
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
