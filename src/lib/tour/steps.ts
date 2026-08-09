/**
 * The five steps, as data plus the acts that set each one up and take it back.
 *
 * The Tour *demonstrates*: every step drives the real app, on the real Props,
 * and the user presses Next, Back or Skip and nothing else (ADR 0015). So a step
 * is not a caption over a rectangle - it is an `enter` that puts the app into
 * the state the copy describes, and an `exit` that undoes exactly that, so Back
 * is a real inverse rather than a second forward move.
 *
 * ## Nothing here imports driver.js
 *
 * That separation is what makes this file testable at all: the spotlight library
 * is an implementation detail of `TourProvider`, and everything that could
 * actually go wrong - the wrong Prop opened, a pin left behind, a step that
 * cannot find its target - is decided here, with no popover in sight.
 *
 * For the same reason a step never reaches for a hook. Everything it needs from
 * the running app arrives as a `TourStage`: navigation the provider has marked
 * as its own, and Prop writes that rebase themselves. A step therefore cannot
 * forget to rebase, because it is not given the un-rebasing version.
 *
 * ## What is left to the DOM
 *
 * Two acts have no React surface to call: opening the mobile speed dial, whose
 * state lives inside `QuickCaptureBar`, and knowing when an act has landed.
 * Both are done by reading and driving the document directly - a click on the
 * `＋` is what a user's finger does too, and `waitFor` asks the DOM whether the
 * app has caught up rather than guessing with a timer.
 */

import type { TourProp } from '@/context/PreferencesProvider.tsx';
import { propByKey } from './props.ts';
import { noteCardTarget, resolveTourTarget, type TourTarget } from './targets.ts';
import { waitFor } from './waitFor.ts';

/**
 * What a step is allowed to do to the running app.
 *
 * Deliberately narrow. Navigation is here because the provider has to *mark* its
 * own navigations - any it did not initiate destroys the Tour - and Prop writes
 * are here because the provider pairs each one with `rebaseProp`, without which
 * the teardown would read the Tour's own pin as the user's edit and refuse to
 * clean up.
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
  /**
   * Identifies the step and names its copy: `onboarding.steps.<key>.title` and
   * `.body`. One key rather than two fields, so a step cannot be renamed in the
   * bundles and not in the list.
   */
  key: string;
  /**
   * What to cut the spotlight over, or `null` when this run has nothing to point
   * at. A function because step 3 aims at one particular Prop's card, whose id
   * does not exist until the Tour has seeded it.
   */
  target: (stage: TourStage) => TourTarget | null;
  /** Puts the app into the state the copy describes. */
  enter?: (stage: TourStage) => Promise<void>;
  /** Takes it back, so stepping Back is an inverse and not a second forward. */
  exit?: (stage: TourStage) => Promise<void>;
}

/** The element a step points at right now, waiting for the app to produce it. */
function waitForTarget(target: TourTarget): Promise<Element | null> {
  return waitFor(() => resolveTourTarget(target));
}

/**
 * Opens or closes the mobile speed dial, by clicking the `＋` the way a thumb
 * would.
 *
 * There is nothing to open above `sm:`, and this is how it knows: the desktop
 * capture bar carries the same `data-tour` name but is a plain wrapper with no
 * expanded state, so a missing `aria-expanded` means "this width has no dial"
 * and the step quietly becomes a spotlight with no act. That is the whole of
 * "one step with two acts" - the two breakpoints are the same idea, and the
 * resolver has already picked which of the pair is on screen.
 *
 * The state is read back rather than assumed, because Radix moves it through
 * React state: two acts in the same tick would otherwise both see the old value
 * and the second would toggle the dial shut again.
 */
async function setSpeedDialOpen(open: boolean): Promise<void> {
  const trigger = resolveTourTarget('capture');
  if (!(trigger instanceof HTMLElement)) return;

  const expanded = () => trigger.getAttribute('aria-expanded');
  if (expanded() === null || expanded() === String(open)) return;

  trigger.click();
  await waitFor(() => expanded() === String(open));
}

export const TOUR_STEPS: TourStep[] = [
  /**
   * 1 - Start anything. The five ways in, which on a phone are folded into one
   * button and on desktop are already spread across the bar.
   */
  {
    key: 'capture',
    target: () => 'capture',
    enter: () => setSpeedDialOpen(true),
    exit: () => setSpeedDialOpen(false),
  },

  /**
   * 2 - Write it. Opens the Prop the Tour keeps for this and points at the
   * toolbar, which is the whole editor in one strip.
   *
   * It does not type into the note. An earlier draft opened the `/` menu here as
   * well, which meant threading a live TipTap instance out through the dialog,
   * writing a character into a Prop and undoing it again on the way back - and
   * the menu would have rendered at the caret, inside the scrim and outside the
   * cutout the step had just cut over the toolbar. The copy says `/` instead.
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
      await waitFor(() => resolveTourTarget('editorToolbar') === null);
    },
  },

  /**
   * 3 - Your wall. Pins the same Prop and lets the masonry re-pack around it.
   *
   * Pinning is the one thing that reorders the feed under a user (ADR 0012), and
   * that is exactly why this step does it: the card visibly moves, so the pin
   * reads as direct manipulation rather than as a claim about a button.
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
   * 4 - Make it yours. The step's act is the navigation itself: Settings is a
   * place, and a Tour that described it without going there would be back to
   * being a caption.
   */
  {
    key: 'settings',
    target: () => 'settingsCustomisation',
    enter: async (stage) => {
      await stage.navigate('/settings');
      await waitForTarget('settingsCustomisation');
    },
    exit: async (stage) => {
      // Back rather than a forward navigation to `/`: the Tour is retracing its
      // own steps, and pushing a third entry would leave the user's history
      // holding the shape of a tutorial they have finished with.
      stage.back();
      await waitForTarget('capture');
    },
  },

  /**
   * 5 - It all lives here. No act: the last step is a fact about where the data
   * is, and the section it points at is the one that gets it off the device.
   */
  {
    key: 'local',
    target: () => 'settingsLocal',
  },
];

/**
 * The cutout's corner radius, taken from the target's own `border-radius`.
 *
 * A number per step was the first plan, and it cannot be right: step 1 points at
 * a 28px circle on a phone and a 16px card on desktop, and they are one step.
 * Reading the element is both shorter and self-maintaining - a card that changes
 * radius takes its spotlight with it.
 *
 * The clamp is not defensive tidiness. Tailwind's `rounded-full` computes to a
 * near-infinite length, which a cutout path cannot use; half the shorter side is
 * what "fully round" means for a real rectangle.
 */
export const DEFAULT_STAGE_RADIUS = 16;

export function stageRadiusOf(element: Element | null): number {
  if (!element) return DEFAULT_STAGE_RADIUS;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  if (!Number.isFinite(radius)) return DEFAULT_STAGE_RADIUS;
  const { width, height } = element.getBoundingClientRect();
  return Math.min(radius, width / 2, height / 2);
}
