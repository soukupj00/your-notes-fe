import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  changesScene,
  leaveScene,
  stageRadiusOf,
  TOUR_STEPS,
  type TourStage,
  type TourStep,
} from './steps.ts';
import { tourTargetSelector } from './targets.ts';
import { TOUR_WAIT_MS } from './waitFor.ts';

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

const PROPS = [
  { id: 'prop-groceries', updatedAt: '2026-08-09T10:00:00.000Z' },
  { id: 'prop-weekend', updatedAt: '2026-08-09T10:00:01.000Z' },
  { id: 'prop-ideas', updatedAt: '2026-08-09T10:00:02.000Z' },
];

/**
 * The narrow layout: a `＋` that step 1 points at and that opens the dial. A closed dial is absent,
 * as Radix leaves it, and that absence is how a step reads its state: never `aria-expanded`.
 */
const FEED = `
  <button data-tour="capture" data-tour-toggle></button>
  ${PROPS.map((prop) => `<article data-note-feed-id="${prop.id}"></article>`).join('')}
`;

/** The wide layout: a bar that *is* the five starts and opens nothing. */
const DESKTOP_FEED = `
  <div data-tour="capture"></div>
  ${PROPS.map((prop) => `<article data-note-feed-id="${prop.id}"></article>`).join('')}
`;

const SETTINGS = `
  <section data-tour="settings-toolbar"></section>
  <section data-tour="settings-quick-capture"></section>
  <section data-tour="settings-local"></section>
`;

/** How long the paper app takes to catch up. Long enough to need waiting for. */
const LATENCY = 10;

function later(work: () => void) {
  setTimeout(work, LATENCY);
}

function paperApp(props = PROPS) {
  const calls: string[] = [];
  document.body.innerHTML = FEED;

  // Radix mounts and unmounts the dial through React state rather than on the
  // click itself, which is exactly the lag `setSpeedDialOpen` reads back for.
  document.querySelector('[data-tour-toggle]')?.addEventListener('click', () => {
    calls.push('dial');
    later(() => {
      const dial = document.querySelector('[data-tour="capture-dial"]');
      if (dial) dial.remove();
      else document.body.insertAdjacentHTML('beforeend', '<ul data-tour="capture-dial"></ul>');
    });
  });

  const stage: TourStage = {
    props,
    openNote: (id) => {
      calls.push(`open:${id}`);
      later(() =>
        document.body.insertAdjacentHTML('beforeend', '<div data-tour="editor-toolbar">')
      );
    },
    closeNote: () => {
      calls.push('close');
      later(() => document.querySelector('[data-tour="editor-toolbar"]')?.remove());
    },
    pinProp: async (id) => {
      calls.push(`pin:${id}`);
    },
    unpinProp: async (id) => {
      calls.push(`unpin:${id}`);
    },
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

function dialOpen() {
  return document.querySelector('[data-tour="capture-dial"]') !== null;
}

/** Lets the paper app finish whatever a step did not wait for. */
const settle = () => new Promise((resolve) => setTimeout(resolve, LATENCY * 3));

afterEach(async () => {
  // Closing the dial is deliberately not awaited, so a test can end with the
  // paper app still catching up. Drained here, or it lands in the next test's
  // document - which is exactly how it first showed up.
  await settle();
  document.body.innerHTML = '';
});

describe('the step list', () => {
  it('is the six steps, in the order the copy is written for', () => {
    // The keys are also the copy's keys (`onboarding.steps.<key>`), so this is
    // the test that fails when a step is renamed in one place only.
    expect(TOUR_STEPS.map((s) => s.key)).toEqual([
      'capture',
      'editor',
      'wall',
      'toolbar',
      'quickCapture',
      'local',
    ]);
  });
});

describe('step 1, the capture affordance', () => {
  it('waits for the dial it is about to spotlight to finish unfolding', async () => {
    // Driver measures the target's rect exactly once, so a dial handed over
    // half-open gets a hole cut over half of it.
    const { stage, calls } = paperApp();

    await step('capture').enter?.(stage);

    expect(dialOpen()).toBe(true);
    expect(calls).toEqual(['dial']);
  });

  it('closes the dial without waiting for it, since the editor is already covering it', async () => {
    // The 430ms this saves on a phone was spent watching a popover fold away
    // underneath the sheet step 2 is opening over it.
    const { stage, calls } = paperApp();
    await step('capture').enter?.(stage);

    await step('capture').exit?.(stage);

    expect(calls).toEqual(['dial', 'dial']);
    // Pressed, but not yet gone: the act returned before the app caught up.
    expect(dialOpen()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, LATENCY * 3));
    expect(dialOpen()).toBe(false);
  });

  it('does not click a dial that is already in the state it wants', async () => {
    const { stage, calls } = paperApp();

    await step('capture').enter?.(stage);
    await step('capture').enter?.(stage);

    expect(calls).toEqual(['dial']);
  });

  it('does nothing at a width that has no dial', async () => {
    // Desktop: the same target name, but a bar that *is* the five starts and
    // has nothing to open. The step keeps its spotlight and loses only its act.
    const { stage, calls } = paperApp();
    document.body.innerHTML = DESKTOP_FEED;

    await step('capture').enter?.(stage);
    await step('capture').exit?.(stage);

    expect(calls).toEqual([]);
  });

  it('does not mistake something else marking the bar for an open dial', async () => {
    // driver.js stamps `aria-expanded="true"` onto whatever it highlights, here the capture bar.
    // Reading it made the wide layout's exit click a `div` with no handler and then wait out
    // the full budget: three dead seconds per run.
    const { stage, calls } = paperApp();
    document.body.innerHTML = DESKTOP_FEED;
    const bar = document.querySelector('[data-tour="capture"]')!;
    bar.setAttribute('aria-haspopup', 'dialog');
    bar.setAttribute('aria-expanded', 'true');

    const started = Date.now();
    await step('capture').exit?.(stage);

    expect(calls).toEqual([]);
    expect(Date.now() - started).toBeLessThan(TOUR_WAIT_MS);
  });
});

describe('step 2, the editor', () => {
  it('opens the Ideas Prop and waits for the toolbar it points at', async () => {
    const { stage, calls } = paperApp();

    await step('editor').enter?.(stage);

    expect(calls).toEqual(['open:prop-ideas']);
    // Waited: the toolbar is mounted a beat after `openNote` returns.
    expect(document.querySelector('[data-tour="editor-toolbar"]')).not.toBeNull();
  });

  it('closes it and waits for the toolbar to leave', async () => {
    const { stage } = paperApp();
    await step('editor').enter?.(stage);

    await step('editor').exit?.(stage);

    expect(document.querySelector('[data-tour="editor-toolbar"]')).toBeNull();
  });
});

describe('step 3, the wall', () => {
  it('points at the Ideas Prop by id', () => {
    const { stage } = paperApp();

    expect(tourTargetSelector(step('wall').target(stage)!)).toBe(
      '[data-note-feed-id="prop-ideas"]'
    );
  });

  it('pins that Prop and unpins it on the way back', async () => {
    const { stage, calls } = paperApp();

    await step('wall').enter?.(stage);
    await step('wall').exit?.(stage);

    expect(calls).toEqual(['pin:prop-ideas', 'unpin:prop-ideas']);
  });
});

describe('step 4, the toolbar in Settings', () => {
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

describe('a run with nothing to demonstrate on', () => {
  it('acts on no Prop rather than throwing', async () => {
    // Reachable: a restored half-finished run, or a user who deleted a Prop
    // mid-Tour. Every step still has to be steppable.
    const { stage, calls } = paperApp([]);

    for (const current of TOUR_STEPS) {
      expect(current.target(stage)).not.toBeUndefined();
      await current.enter?.(stage);
      await current.exit?.(stage);
    }

    expect(calls.filter((call) => call.includes('prop'))).toEqual([]);
  });
});

describe('every step round-trips', () => {
  // The contract behind Back: `exit` is an inverse, or Back walks sideways and leaves litter.
  // Settled before comparing, because step 1 deliberately does not await closing the dial.
  it.each(TOUR_STEPS.map((current) => [current.key, current] as const))(
    '%s leaves the app where it found it',
    async (_key, current) => {
      const { stage } = paperApp();
      const before = document.body.innerHTML;

      await current.enter?.(stage);
      await current.exit?.(stage);
      await settle();

      expect(document.body.innerHTML).toBe(before);
    }
  );
});

describe('moving between steps', () => {
  const at = (key: string) => TOUR_STEPS.findIndex((step) => step.key === key);

  it('changes scene for every move but the ones that share a place', () => {
    // Steps 4, 5 and 6 are Settings looked at three times. Exiting step 4 on the
    // way to step 5 would bounce the user back to the Feed and then have to
    // navigate to Settings again, with the whole flash in between.
    expect(changesScene(at('toolbar'), at('quickCapture'))).toBe(false);
    expect(changesScene(at('quickCapture'), at('toolbar'))).toBe(false);
    expect(changesScene(at('quickCapture'), at('local'))).toBe(false);
    expect(changesScene(at('local'), at('quickCapture'))).toBe(false);

    expect(changesScene(at('capture'), at('editor'))).toBe(true);
    expect(changesScene(at('editor'), at('wall'))).toBe(true);
    expect(changesScene(at('wall'), at('toolbar'))).toBe(true);
    expect(changesScene(at('toolbar'), at('wall'))).toBe(true);
  });

  it('unwinds one step when that step is the whole scene', async () => {
    const { stage, calls } = paperApp();
    await step('wall').enter?.(stage);
    calls.length = 0;

    await leaveScene(at('wall'), stage);

    expect(calls).toEqual(['unpin:prop-ideas']);
  });

  it('unwinds the step that opened the scene as well, when ending on a continuation', async () => {
    // Ending on step 6 must undo step 4's navigation, where the scene was entered.
    // `leaveScene` walks the `continues` chain, so this holds however long it grows.
    const { stage, calls } = paperApp();
    await step('toolbar').enter?.(stage);
    calls.length = 0;

    await leaveScene(at('local'), stage);

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
