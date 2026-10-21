import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  changesScene,
  leaveScene,
  stageRadiusOf,
  TOUR_STEPS,
  type TourStage,
  type TourStep,
} from './steps.ts';

/**
 * A paper app: divs with the real `data-tour` names and a `TourStage` that mutates them, which is
 * enough to pin that every act has an inverse. jsdom measures 0x0, hence the rect patch below and
 * `e2e/onboarding.spec.ts` for whatever needs a real browser.
 */

beforeAll(() => {
  // Connected means visible. `resolveTourTarget` skips anything measuring
  // nothing, which in unpatched jsdom is every element in the document.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const size = this.isConnected ? 120 : 0;
    return { width: size, height: size } as DOMRect;
  };
});

const FEED = '<div data-tour="capture"></div>';

const SETTINGS = `
  <section data-tour="settings-toolbar"></section>
  <section data-tour="settings-quick-capture"></section>
  <section data-tour="settings-sync"></section>
`;

/** How long the paper app takes to catch up. Long enough to need waiting for. */
const LATENCY = 10;

function later(work: () => void) {
  setTimeout(work, LATENCY);
}

function paperApp() {
  const calls: string[] = [];
  document.body.innerHTML = FEED;

  const stage: TourStage = {
    navigate: async (to) => {
      calls.push(`navigate:${to}`);
      later(() => {
        document.body.innerHTML = SETTINGS;
      });
    },
    back: () => {
      calls.push('back');
      later(() => {
        document.body.innerHTML = FEED;
      });
    },
  };

  return { stage, calls };
}

function step(key: string): TourStep {
  const found = TOUR_STEPS.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no step ${key}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the step list', () => {
  it('is the three steps, in the order the copy is written for', () => {
    // The keys are also the copy's keys (`onboarding.steps.<key>`), so this is
    // the test that fails when a step is renamed in one place only.
    expect(TOUR_STEPS.map((s) => s.key)).toEqual(['toolbar', 'quickCapture', 'sync']);
  });
});

describe('step 1, the toolbar in Settings', () => {
  it('navigates there and waits for the block it points at', async () => {
    const { stage, calls } = paperApp();

    await step('toolbar').enter?.(stage);

    expect(calls).toEqual(['navigate:/settings']);
    expect(document.querySelector('[data-tour="settings-toolbar"]')).not.toBeNull();
  });

  it('retreats by popping history rather than navigating forward again', async () => {
    const { stage, calls } = paperApp();
    await step('toolbar').enter?.(stage);

    await step('toolbar').exit?.(stage);

    expect(calls).toEqual(['navigate:/settings', 'back']);
    expect(document.querySelector('[data-tour="capture"]')).not.toBeNull();
  });
});

describe('step 3, where the notes live', () => {
  it('points at the sync section when it rendered', () => {
    document.body.innerHTML = SETTINGS;

    expect(step('sync').target()).toBe('settingsSync');
  });

  it('points at nothing when the section rendered nothing', () => {
    // No Storage API and no signed-in Device: the anchor is there, but empty, so it measures 0x0.
    document.body.innerHTML = '<div data-tour="settings-sync"></div>';
    const anchor = document.querySelector('[data-tour="settings-sync"]')!;
    anchor.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;

    expect(step('sync').target()).toBeNull();
  });
});

describe('every step round-trips', () => {
  // The contract behind Back: `exit` is an inverse, or Back walks sideways and leaves litter.
  it.each(TOUR_STEPS.map((current) => [current.key, current] as const))(
    '%s leaves the app where it found it',
    async (_key, current) => {
      const { stage } = paperApp();
      const before = document.body.innerHTML;

      await current.enter?.(stage);
      await current.exit?.(stage);

      expect(document.body.innerHTML).toBe(before);
    }
  );
});

describe('moving between steps', () => {
  const at = (key: string) => TOUR_STEPS.findIndex((step) => step.key === key);

  it('never changes scene, as all three share Settings', () => {
    // Exiting step 1 on the way to step 2 would bounce the user back to the Feed
    // and then have to navigate to Settings again, with the whole flash in between.
    expect(changesScene(at('toolbar'), at('quickCapture'))).toBe(false);
    expect(changesScene(at('quickCapture'), at('toolbar'))).toBe(false);
    expect(changesScene(at('quickCapture'), at('sync'))).toBe(false);
    expect(changesScene(at('sync'), at('quickCapture'))).toBe(false);
  });

  it('unwinds the step that opened the scene as well, when ending on a continuation', async () => {
    // Ending on step 3 must undo step 1's navigation, where the scene was entered.
    // `leaveScene` walks the `continues` chain, so this holds however long it grows.
    const { stage, calls } = paperApp();
    await step('toolbar').enter?.(stage);
    calls.length = 0;

    await leaveScene(at('sync'), stage);

    expect(calls).toEqual(['back']);
  });
});

describe('stageRadiusOf', () => {
  // Set as the longhand: jsdom does not expand `border-radius` into its corners, so the
  // shorthand would read back as 0 and test nothing. Browsers do expand it.
  function withRadius(radius: string) {
    const element = document.createElement('div');
    element.style.borderTopLeftRadius = radius;
    document.body.append(element);
    return element;
  }

  it('takes the target its own corner radius, so one step can be a circle at one width and a card at another', () => {
    expect(stageRadiusOf(withRadius('10px'))).toBe(10);
  });

  it('clamps a pill to half the element, since `rounded-full` computes to a near-infinite length', () => {
    // The patched rect above is 120 square.
    expect(stageRadiusOf(withRadius('9999px'))).toBe(60);
  });

  it('cuts a square hole over a square target', () => {
    expect(stageRadiusOf(withRadius(''))).toBe(0);
  });

  it('falls back to the card radius when there is no element to read at all', () => {
    // Which is the case a step whose target never resolved lands in.
    expect(stageRadiusOf(null)).toBe(16);
  });
});
