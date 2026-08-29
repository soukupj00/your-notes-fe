/**
 * The six steps, as data plus the acts that set each one up and take it back.
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

import { propByKey, type TourProp } from './props.ts';
import {
  noteCardTarget,
  resolveTourTarget,
  type TourTarget,
  tourTargetSelector,
} from './targets.ts';
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
  /**
   * This step is shown in the scene the step before it set up, so stepping
   * between the two neither enters nor exits anything.
   *
   * Steps 5 and 6 carry it, and it is what keeps `exit` a strict inverse
   * everywhere else. Every other move is "leave this scene, enter that one":
   * the app's state is not additive - step 2's editor covers the wall step 3
   * points at - so a step that only ever entered would arrive to find the
   * previous step's act in the way. The last three steps are the exception
   * because they are the same place looked at three times, and running step 4's
   * `exit` on the way to step 5 would bounce the user back to the Feed and then
   * have to navigate to Settings again.
   *
   * `TourProvider` also reads it in reverse: ending the Tour on step 6 has to
   * unwind back to step 4, because step 4 is where the scene was entered. That
   * walk is `leaveScene`, which follows the chain rather than counting - so
   * adding a fourth look at Settings would need no change here.
   */
  continues?: boolean;
}

/** The element a step points at right now, waiting for the app to produce it. */
function waitForTarget(target: TourTarget): Promise<Element | null> {
  return waitFor(() => resolveTourTarget(target), { label: tourTargetSelector(target) });
}

/**
 * Opens or closes the mobile speed dial, by clicking the `＋` the way a thumb
 * would.
 *
 * Two questions, each answered by the DOM rather than inferred:
 *
 * 1. **Is there a dial at this width?** Only the narrow layout has a control
 *    that opens one, and `captureToggle` marks it. Above `sm:` it resolves to
 *    nothing and the step quietly becomes a spotlight with no act - the bar
 *    there *is* the five starts. That is the whole of "one step with two acts".
 * 2. **Is it open?** The five starts are on screen, which is `captureDial`, the
 *    same resolve the step uses to choose its own target.
 *
 * **Neither question may be asked of `aria-expanded`, and that is not a style
 * preference.** The spotlight library stamps `aria-expanded="true"` onto
 * whatever element it highlights (driver.js `highlight`, alongside
 * `aria-haspopup` and `aria-controls`). Step 1 highlights the capture bar, so
 * from the first frame of the Tour that attribute says "open" on a desktop bar
 * that opens nothing - and reading it here cost three seconds per run: the exit
 * clicked a `div` with no handler and then waited out the whole `waitFor`
 * budget for an attribute it did not own. Ask the app what is on screen; ARIA on
 * a spotlit element belongs to the spotlight.
 *
 * ## Opening is awaited; closing is not
 *
 * Opening has to be: the dial *is* what step 1 spotlights, and driver measures
 * that rect once, so handing it a dial mid-unfold cuts the hole over half of it.
 *
 * Closing has nobody waiting on it. It is the last thing step 1 does on its way
 * to step 2, whose first act covers the whole screen with the editor - so the
 * dial folds away behind a sheet that is already opening, and awaiting it only
 * delays the note. On a phone at 4x CPU that wait was **430 ms of the 1363 ms**
 * step 1 → 2 cost, spent watching a popover the user is about to stop seeing.
 *
 * What the asymmetry costs is the guarantee that a step arrives to a settled
 * dial. It is safe for the one move that could care - Back, from step 2 - only
 * because that move closes the editor first and *does* await it, which is far
 * longer than Radix's unmount. If that ever stops being true, the symptom is
 * step 1 spotlighting the `＋` instead of the starts, not a broken Tour.
 *
 * The state is still read before clicking rather than assumed, because Radix
 * moves it through React state: two acts in the same tick would otherwise both
 * see the old value and the second would toggle the dial shut again.
 */
async function setSpeedDialOpen(open: boolean): Promise<void> {
  const toggle = resolveTourTarget('captureToggle');
  if (!(toggle instanceof HTMLElement)) return;

  const isOpen = () => resolveTourTarget('captureDial') !== null;
  if (isOpen() === open) return;

  toggle.click();
  if (!open) return;
  await waitFor(isOpen, { label: 'the speed dial to unfold' });
}

export const TOUR_STEPS: TourStep[] = [
  /**
   * 1 - Start anything. The five ways in, which on a phone are folded into one
   * button and on desktop are already spread across the bar.
   */
  {
    key: 'capture',
    // Whichever of the two is on screen once the act has run: the unfolded dial
    // on a phone, the bar that never folded on a desktop. The step points at the
    // five starts either way, which is the only thing its copy claims.
    target: () => (resolveTourTarget('captureDial') ? 'captureDial' : 'capture'),
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
      await waitFor(() => resolveTourTarget('editorToolbar') === null, {
        label: 'the editor to close',
      });
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
   * 4 - Your toolbar. The step's act is the navigation itself: Settings is a
   * place, and a Tour that described it without going there would be back to
   * being a caption.
   *
   * It points at the preview strip, not at the section holding it. That is a
   * measurement, not taste: `EditorToolbarSection` is **880px on an 839px
   * phone**, and the app is `inert` for the Tour's lifetime, so a cutout over it
   * is a hole whose bottom edge the user can never reach. This step and the next
   * were one step (`settings`, over a 1296px block covering both sections) and
   * split for exactly that reason.
   */
  {
    key: 'toolbar',
    target: () => 'settingsToolbar',
    enter: async (stage) => {
      await stage.navigate('/settings');
      await waitForTarget('settingsToolbar');
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
   * 5 - Your quick starts. The second half of the old step 4, and the reason it
   * needs no act of its own: step 4 is already in Settings, so this is the same
   * scene looked at again - hence `continues`.
   */
  {
    key: 'quickCapture',
    target: () => 'settingsQuickCapture',
    continues: true,
  },

  /**
   * 6 - It all lives here. No act: the last step is a fact about where the data
   * is, and the section it points at is the one that gets it off the device.
   *
   * Still in the scene step 4 entered, two steps back now. `leaveScene` walks
   * the `continues` chain until it reaches the step that entered the scene, so
   * the chain length is not something this file has to state.
   */
  {
    key: 'local',
    target: () => 'settingsLocal',
    continues: true,
  },
];

// --- Moving between steps ---------------------------------------------------
//
// A step is a scene, not a layer. The app's state between steps is not additive
// - step 2's editor covers the wall step 3 points at - so a move is "leave this
// scene, enter that one" rather than a stack that only ever grows. That is what
// keeps `exit` a strict inverse of `enter`, which is the contract the round-trip
// tests below pin, and it is why Back needs no separate machinery: it is the
// same move in the other direction.
//
// The one exception is a step that `continues` the one before it, which is a
// second look at a scene already entered.

/**
 * Whether moving between these two steps changes scene, and so whether anything
 * has to be exited and entered at all.
 *
 * The later of the pair decides, in both directions: it is the one that either
 * declares itself a continuation or does not.
 */
export function changesScene(from: number, to: number): boolean {
  return !TOUR_STEPS[Math.max(from, to)]?.continues;
}

/**
 * Unwinds the scene the given step is shown in, innermost act first.
 *
 * Usually that is just the step's own `exit`; the chain has a second link only
 * where a step `continues` the one before it, and then leaving means undoing
 * both - the scene was entered by the earlier of the two.
 */
export async function leaveScene(from: number, stage: TourStage): Promise<void> {
  for (let index = from; index >= 0; index--) {
    await TOUR_STEPS[index].exit?.(stage);
    if (!TOUR_STEPS[index].continues) return;
  }
}

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
const DEFAULT_STAGE_RADIUS = 16;

export function stageRadiusOf(element: Element | null): number {
  if (!element) return DEFAULT_STAGE_RADIUS;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  if (!Number.isFinite(radius)) return DEFAULT_STAGE_RADIUS;
  const { width, height } = element.getBoundingClientRect();
  return Math.min(radius, width / 2, height / 2);
}
