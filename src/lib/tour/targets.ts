/**
 * What each Tour step points at, and how that becomes an element.
 *
 * The names live here rather than being spelled out at each step, so a `data-tour`
 * attribute has exactly one place that knows about it.
 *
 * ## Why a resolver, rather than `document.querySelector`
 *
 * Two of the app's surfaces are mounted twice, once per breakpoint, with CSS
 * hiding one of the pair: `DesktopCaptureBar` is `hidden sm:flex` and
 * `QuickCaptureBar` is `sm:hidden`, so both are always in the document and a
 * naive `querySelector` matches the invisible one on one of the two widths.
 * (`searchInput.tsx` is duplicated the same way, though nothing points at it.)
 * So the resolver takes the first match with a **non-zero client rect** - the
 * one the user can actually see, and the only one a spotlight can be cut over.
 *
 * That check is also the reason none of this can be verified in jsdom, which
 * returns zeroed rects for everything and applies no CSS at all: at both widths
 * every match measures 0x0 and neither is more visible than the other. The
 * "resolves at both breakpoints" guarantee is therefore `e2e/tour-targets.spec.ts`,
 * in a real browser at two real viewports; the unit test beside this file covers
 * the resolver's own logic against rects it stubs itself.
 */

/** Every fixed target, and the attribute that marks it. */
export const TOUR_TARGETS = {
  /** Step 1: the `＋` speed dial below `sm:`, the "Take a note" bar above it. */
  capture: '[data-tour="capture"]',
  /** Step 2: the editor's toolbar, inside the open note. */
  editorToolbar: '[data-tour="editor-toolbar"]',
  /** Step 4: the customisation block in Settings. */
  settingsCustomisation: '[data-tour="settings-customisation"]',
  /**
   * Step 5: the "your data is on this device" block in Settings.
   *
   * This is `BackupSection` and **not** `PwaInstallSection`, which the file
   * manifest originally named. `PwaInstallSection` returns `null` unless the
   * browser is offering an install, which it is not once the app is installed,
   * not at all on desktop Firefox, and not in a headless browser - so step 5
   * would be dropped for most users. It is the step carrying the one fact whose
   * absence can cost somebody everything they have written, so it may not be the
   * step that goes missing. Exporting a zip is the actionable half of the same
   * message, and that section always renders.
   */
  settingsLocal: '[data-tour="settings-local"]',
} as const;

export type TourTargetName = keyof typeof TOUR_TARGETS;

/**
 * A step's target: one of the fixed names, or a selector computed when the step
 * runs. Step 3 needs the second kind - it points at one particular Prop's card,
 * whose id does not exist until the Tour has seeded it.
 */
export type TourTarget = TourTargetName | { selector: string };

/**
 * The card for one note on the wall. `NoteFeed` already stamps
 * `data-note-feed-id` on both the Masonry and the Stack branch, so this needs no
 * attribute of its own.
 */
export function noteCardTarget(noteId: string): TourTarget {
  return { selector: `[data-note-feed-id="${CSS.escape(noteId)}"]` };
}

export function tourTargetSelector(target: TourTarget): string {
  return typeof target === 'string' ? TOUR_TARGETS[target] : target.selector;
}

/**
 * The visible element a step points at, or `null` when there is not one.
 *
 * `null` is a normal answer, not a failure: a step whose target is absent is
 * dropped from the run before the spotlight starts, so that the "3 of 5" counter
 * cannot promise a step the user will never be shown.
 */
export function resolveTourTarget(target: TourTarget, root: ParentNode = document): Element | null {
  for (const element of root.querySelectorAll(tourTargetSelector(target))) {
    const { width, height } = element.getBoundingClientRect();
    if (width > 0 && height > 0) return element;
  }
  return null;
}
