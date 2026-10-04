/**
 * The six Tour steps. Each `enter` puts the real app into the state its copy describes and `exit`
 * undoes exactly that, so Back is a true inverse (ADR 0015, CLAUDE.md "The Tour").
 */

import { propByKey, type TourProp } from './props.ts';
import { noteCardTarget, resolveTourTarget, type TourTarget } from './targets.ts';
import { waitFor, waitForGone, waitForTarget } from './waitFor.ts';

/**
 * Deliberately narrow. Navigation is here so the provider can mark it as its own (any other ends
 * the Tour), and Prop writes so each is paired with `rebaseProp`: a step cannot skip the rebase.
 */
export interface TourStage {
  /** The Props on the wall this run, in the order `createProps` wrote them. */
  props: TourProp[];
  /** Opens a note's editor: a navigation, so Back closes it (ADR 0014). */
  openNote: (id: string) => void;
  /** Closes it again by popping the entry `openNote` pushed. */
  closeNote: () => void;
  pinProp: (id: string) => Promise<void>;
  unpinProp: (id: string) => Promise<void>;
  navigate: (to: string) => Promise<void>;
  /** Pops one history entry, which is how a navigating step retreats. */
  back: () => void;
}

export interface TourStep {
  /** Also names its copy (`onboarding.steps.<key>.title`/`.body`), so the two cannot drift. */
  key: string;
  /**
   * `null` when this run has nothing to point at. A function because step 3 aims at one Prop's
   * card, whose id does not exist until the Tour has seeded it.
   */
  target: (stage: TourStage) => TourTarget | null;
  /** Puts the app into the state the copy describes. */
  enter?: (stage: TourStage) => Promise<void>;
  /** Takes it back, so stepping Back is an inverse and not a second forward. */
  exit?: (stage: TourStage) => Promise<void>;
  /**
   * Shown in the scene the previous step set up, so moving between the two enters and exits
   * nothing. Steps 5 and 6 look again at step 4's Settings; `leaveScene` walks the chain back.
   */
  continues?: boolean;
}

/**
 * Clicks the `＋` as a thumb would; above `sm:` there is no toggle, so it does nothing. Never read
 * `aria-expanded`: driver.js stamps it onto whatever it spotlights, so it says "open" on a bar that
 * opens nothing. Opening is awaited and closing is not, as CLAUDE.md "The Tour" explains.
 */
async function setSpeedDialOpen(open: boolean): Promise<void> {
  const toggle = resolveTourTarget('captureToggle');
  if (!(toggle instanceof HTMLElement)) return;

  const isOpen = () => resolveTourTarget('captureDial') !== null;
  // Read, not assumed: Radix applies the toggle through React state, so two acts in one tick
  // would both see the old value and the second would shut the dial again.
  if (isOpen() === open) return;

  toggle.click();
  if (!open) return;
  await waitFor(isOpen, { label: 'the speed dial to unfold' });
}

export const TOUR_STEPS: TourStep[] = [
  /** 1 - Start anything: the five starts, folded behind one button on a phone. */
  {
    key: 'capture',
    // The unfolded dial on a phone, the bar on desktop: the five starts either way.
    target: () => (resolveTourTarget('captureDial') ? 'captureDial' : 'capture'),
    enter: () => setSpeedDialOpen(true),
    exit: () => setSpeedDialOpen(false),
  },

  /**
   * 2 - Write it. Deliberately does not open the `/` menu: that means typing into a Prop and
   * undoing it, and the menu renders at the caret, outside the toolbar's cutout. The copy says `/`.
   */
  {
    key: 'editor',
    target: () => 'editorToolbar',
    enter: async (stage) => {
      const prop = propByKey(stage.props, 'ideas');
      if (!prop) return;
      stage.openNote(prop.id);
      await waitForTarget('editorToolbar');
    },
    exit: async (stage) => {
      stage.closeNote();
      // The editor is a Radix dialog with an exit animation, so "closed" is when
      // its toolbar has left the document, not when the router has been told.
      await waitForGone(['editorToolbar'], { label: 'the editor to close' });
    },
  },

  /**
   * 3 - Your wall. Pins the same Prop because pinning is the one thing that reorders the feed under
   * a user (ADR 0012): the card visibly moves, so the pin reads as an act, not a claim.
   */
  {
    key: 'wall',
    target: (stage) => {
      const prop = propByKey(stage.props, 'ideas');
      return prop ? noteCardTarget(prop.id) : null;
    },
    enter: async (stage) => {
      const prop = propByKey(stage.props, 'ideas');
      if (!prop) return;
      await stage.pinProp(prop.id);
      await waitForTarget(noteCardTarget(prop.id));
    },
    exit: async (stage) => {
      const prop = propByKey(stage.props, 'ideas');
      if (prop) await stage.unpinProp(prop.id);
    },
  },

  /**
   * 4 - Your toolbar. Going to Settings is the act. It points at the preview strip, not the
   * section, for the size reason on `settingsToolbar` in `targets.ts`; that is why 4 and 5 split.
   */
  {
    key: 'toolbar',
    target: () => 'settingsToolbar',
    enter: async (stage) => {
      await stage.navigate('/settings');
      await waitForTarget('settingsToolbar');
    },
    exit: async (stage) => {
      // Back rather than navigating to `/`, so the user's history does not keep the tutorial.
      stage.back();
      await waitForTarget('capture');
    },
  },

  /** 5 - Your quick starts. Step 4's Settings scene seen again, so no act of its own. */
  {
    key: 'quickCapture',
    target: () => 'settingsQuickCapture',
    continues: true,
  },

  /**
   * 6 - It all lives here. No act: a fact about where the data is, pointing at the section that
   * gets it off the device. Still step 4's scene.
   */
  {
    key: 'local',
    target: () => 'settingsLocal',
    continues: true,
  },
];

/**
 * Whether a move changes scene: a step is a scene, not a layer (CLAUDE.md "The Tour"). The later of
 * the pair decides, in both directions, as it is the one that declares itself a continuation.
 */
export function changesScene(from: number, to: number): boolean {
  return !TOUR_STEPS[Math.max(from, to)]?.continues;
}

/** Unwinds a step's scene, innermost act first, back to the step that entered it. */
export async function leaveScene(from: number, stage: TourStage): Promise<void> {
  for (let index = from; index >= 0; index--) {
    await TOUR_STEPS[index].exit?.(stage);
    if (!TOUR_STEPS[index].continues) return;
  }
}

const DEFAULT_STAGE_RADIUS = 16;

/**
 * The cutout's radius is read from the target, not set per step: step 1 is a circle on a phone
 * and a card on desktop. Clamped to half the shorter side, as `rounded-full` is near-infinite.
 */
export function stageRadiusOf(element: Element | null): number {
  if (!element) return DEFAULT_STAGE_RADIUS;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  if (!Number.isFinite(radius)) return DEFAULT_STAGE_RADIUS;
  const { width, height } = element.getBoundingClientRect();
  return Math.min(radius, width / 2, height / 2);
}
