/**
 * Several surfaces are mounted twice with CSS hiding one, so a target resolves to the first match
 * with a non-zero rect (CLAUDE.md "The Tour"). jsdom measures everything as 0x0, so only
 * `e2e/onboarding.spec.ts`, which fails on a dropped step, proves both breakpoints resolve.
 */

export const TOUR_TARGETS = {
  /** Not a step: the Feed is on screen. The `＋` below `sm:`, the "Take a note" bar above it. */
  capture: '[data-tour="capture"]',
  /**
   * Step 1: the preview strip, not `EditorToolbarSection`. The section is 880px tall on an 839px
   * phone and the inert app cannot scroll, so a cutout over it could never be seen whole.
   */
  settingsToolbar: '[data-tour="settings-toolbar"]',
  /** Step 2: the quick-start order and the ＋'s side, in Settings. */
  settingsQuickCapture: '[data-tour="settings-quick-capture"]',
  /** Step 3: "Storage and sync", which renders nothing without the Storage API or a server. */
  settingsSync: '[data-tour="settings-sync"]',
} as const;

export type TourTargetName = keyof typeof TOUR_TARGETS;

/** `null` is a normal answer: a step whose target is absent is shown without a cutout. */
export function resolveTourTarget(
  target: TourTargetName,
  root: ParentNode = document
): Element | null {
  for (const element of root.querySelectorAll(TOUR_TARGETS[target])) {
    const { width, height } = element.getBoundingClientRect();
    if (width > 0 && height > 0) return element;
  }
  return null;
}
