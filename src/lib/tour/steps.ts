/**
 * The three Tour steps. Each `enter` puts the real app into the state its copy describes and `exit`
 * undoes exactly that, so Back is a true inverse (ADR 0023, CLAUDE.md "The Tour").
 */

import { resolveTourTarget, type TourTargetName } from './targets.ts';
import { waitForTarget } from './waitFor.ts';

/**
 * Deliberately narrow. Navigation is here so the provider can mark it as its own: any other ends
 * the Tour.
 */
export interface TourStage {
  navigate: (to: string) => Promise<void>;
  /** Pops one history entry, which is how a navigating step retreats. */
  back: () => void;
}

export interface TourStep {
  /** Also names its copy (`onboarding.steps.<key>.title`/`.body`), so the two cannot drift. */
  key: string;
  /** `null` when this run has nothing to point at; the popover then shows without a cutout. */
  target: () => TourTargetName | null;
  /** Puts the app into the state the copy describes. */
  enter?: (stage: TourStage) => Promise<void>;
  /** Takes it back, so stepping Back is an inverse and not a second forward. */
  exit?: (stage: TourStage) => Promise<void>;
  /**
   * Shown in the scene the previous step set up, so moving between the two enters and exits
   * nothing. Steps 2 and 3 look again at step 1's Settings; `leaveScene` walks the chain back.
   */
  continues?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  /**
   * 1 - Your toolbar. Going to Settings is the act. It points at the preview strip, not the
   * section, for the size reason on `settingsToolbar` in `targets.ts`; that is why 1 and 2 split.
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

  /** 2 - Ways to start a note. Step 1's Settings scene seen again, so no act of its own. */
  {
    key: 'quickCapture',
    target: () => 'settingsQuickCapture',
    continues: true,
  },

  /**
   * 3 - Where your notes live. Still step 1's scene. Read, not waited for: the section renders
   * nothing without the Storage API or a signed-in Device, and a spent wait is always a bug.
   */
  {
    key: 'sync',
    target: () => (resolveTourTarget('settingsSync') ? 'settingsSync' : null),
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
