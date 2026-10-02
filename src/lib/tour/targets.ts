/**
 * Several surfaces are mounted twice with CSS hiding one, so a target resolves to the first match
 * with a non-zero rect (CLAUDE.md "The Tour"). jsdom measures everything as 0x0, so only
 * `e2e/onboarding.spec.ts`, which fails on a dropped step, proves both breakpoints resolve.
 */

export const TOUR_TARGETS = {
  /** Step 1: the `＋` speed dial below `sm:`, the "Take a note" bar above it. */
  capture: '[data-tour="capture"]',
  /**
   * Step 1 with the dial open. The starts unfold above the `＋`, so a cutout over the button would
   * leave them in the dark. Above `sm:` this resolves to nothing and `capture` keeps the spotlight.
   */
  captureDial: '[data-tour="capture-dial"]',
  /**
   * Only the narrow layout has a dial to open, so resolving to nothing tells a step there is
   * nothing to click. Separate from `capture`, which is the same element only below `sm:`.
   */
  captureToggle: '[data-tour-toggle]',
  /** Step 2: the editor's toolbar, inside the open note. */
  editorToolbar: '[data-tour="editor-toolbar"]',
  /**
   * Step 4: the preview strip, not `EditorToolbarSection`. The section is 880px tall on an 839px
   * phone and the inert app cannot scroll, so a cutout over it could never be seen whole.
   */
  settingsToolbar: '[data-tour="settings-toolbar"]',
  /** Step 5: the quick-start order and the ＋'s side, in Settings. */
  settingsQuickCapture: '[data-tour="settings-quick-capture"]',
  /**
   * Step 6: `BackupSection`, not `PwaInstallSection`, which renders nothing once installed, on
   * desktop Firefox and when headless. This step carries the one fact that may never go missing.
   */
  settingsLocal: '[data-tour="settings-local"]',
} as const;

export type TourTargetName = keyof typeof TOUR_TARGETS;

/** A fixed name, or a selector computed when the step runs (step 3's Prop card). */
export type TourTarget = TourTargetName | { selector: string };

/** Reuses the `data-note-feed-id` that `NoteFeed` stamps in both Masonry and Stack. */
export function noteCardTarget(noteId: string): TourTarget {
  return { selector: `[data-note-feed-id="${CSS.escape(noteId)}"]` };
}

export function tourTargetSelector(target: TourTarget): string {
  return typeof target === 'string' ? TOUR_TARGETS[target] : target.selector;
}

/**
 * `null` is a normal answer: a step whose target is absent is dropped before the spotlight
 * starts, so the step counter never promises a step the user will not be shown.
 */
export function resolveTourTarget(target: TourTarget, root: ParentNode = document): Element | null {
  for (const element of root.querySelectorAll(tourTargetSelector(target))) {
    const { width, height } = element.getBoundingClientRect();
    if (width > 0 && height > 0) return element;
  }
  return null;
}
