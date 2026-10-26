/**
 * The three Tour steps, all in Settings, where the Tour runs (ADR 0024). A step only points: the
 * user is already where it looks, so no step acts and leaving needs nothing undone.
 */

import type { TourTargetName } from './targets.ts';

export interface TourStep {
  /** Also names its copy (`onboarding.steps.<key>.title`/`.body`), so the two cannot drift. */
  key: string;
  /** `null` when this run has nothing to point at; the popover then shows without a cutout. */
  target: () => TourTargetName | null;
}

export const TOUR_STEPS: TourStep[] = [
  /** 1 - Your toolbar. */
  { key: 'toolbar', target: () => 'settingsToolbar' },

  /** 2 - Ways to start a note. */
  { key: 'quickCapture', target: () => 'settingsQuickCapture' },

  /** 3 - Where your notes live. */
  { key: 'sync', target: () => 'settingsSync' },
];

const DEFAULT_STAGE_RADIUS = 16;

/**
 * The cutout's radius is read from the target, not set per step, so it follows the anchor's own
 * corners. Clamped to half the shorter side, as `rounded-full` is near-infinite.
 */
export function stageRadiusOf(element: Element | null): number {
  if (!element) return DEFAULT_STAGE_RADIUS;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  if (!Number.isFinite(radius)) return DEFAULT_STAGE_RADIUS;
  const { width, height } = element.getBoundingClientRect();
  return Math.min(radius, width / 2, height / 2);
}
