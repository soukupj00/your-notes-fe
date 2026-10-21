/**
 * The Welcome: one overlay at first launch whose marks point at where to begin (ADR 0024). The
 * React half is `components/tour/Welcome.tsx`; what it decides is here.
 */

import type { TourTargetName } from './targets.ts';

/** In reading order. Each `key` also names its copy, `welcome.marks.<key>`. */
export const WELCOME_MARKS = [
  { key: 'capture', target: 'capture' },
  { key: 'settings', target: 'settingsGear' },
] as const satisfies readonly { key: string; target: TourTargetName }[];

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CalloutPlacement {
  /** Below a target in the top half of the screen, above one in the bottom half. */
  side: 'below' | 'above';
  left: number;
  /** From the viewport's top when below, from its bottom when above, so no height is measured. */
  offset: number;
  /** The arrow's x inside the callout: under the target's centre, but never in a corner. */
  arrow: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function placeCallout(
  target: Box,
  viewport: { width: number; height: number },
  {
    width,
    gap,
    gutter = 16,
    arrowInset = 20,
  }: {
    width: number;
    gap: number;
    gutter?: number;
    arrowInset?: number;
  }
): CalloutPlacement {
  const centre = target.left + target.width / 2;
  const left = clamp(centre - width / 2, gutter, viewport.width - gutter - width);
  const arrow = clamp(centre - left, arrowInset, width - arrowInset);
  if (target.top + target.height / 2 < viewport.height / 2) {
    return { side: 'below', left, offset: target.top + target.height + gap, arrow };
  }
  return { side: 'above', left, offset: viewport.height - target.top + gap, arrow };
}
