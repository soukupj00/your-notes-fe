/**
 * Several surfaces are mounted twice with CSS hiding one, so a target resolves to the first match
 * with a non-zero rect (CLAUDE.md "Onboarding"). jsdom measures everything as 0x0, so only
 * `e2e/onboarding.spec.ts`, which fails on a dropped step, proves both breakpoints resolve.
 */

export const TOUR_TARGETS = {
  /** The Welcome's first mark: the `＋` below `sm:`, the "Take a note" bar above it. */
  capture: '[data-tour="capture"]',
  /** The Welcome's second mark: the topbar gear, Settings' one entry point. */
  settingsGear: '[data-tour="settings-gear"]',
  // The Settings steps wait for `data-settled`: the Home's top card mounts once the server has
  // answered and moves every row, and driver measures a cutout only once.
  /** Step 1: the Editor toolbar row on the Settings home. */
  settingsToolbar: '[data-settled] [data-tour="settings-toolbar-row"]',
  /** Step 2: the Quick capture row on the Settings home. */
  settingsQuickCapture: '[data-settled] [data-tour="settings-quick-capture-row"]',
  /** Step 3: the data row on the Settings home, there whatever the account. */
  settingsSync: '[data-settled] [data-tour="settings-data-row"]',
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
