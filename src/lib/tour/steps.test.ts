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

/**
 * The steps are tested against a paper app: a few divs carrying the same
 * `data-tour` names the real one does, and a `TourStage` that mutates them the
 * way the router and Dexie eventually would.
 *
 * That is the whole point of the stage existing. A step's act is "open this
 * note, then wait for the toolbar to appear", and whether the toolbar comes from
 * TipTap or from a `setTimeout` here changes nothing about the step - so the one
 * thing worth pinning, that every act has an inverse and the app ends where it
 * started, is answerable with no app at all.
 *
 * What is *not* answerable here is anything about a rect, since jsdom measures
 * everything as 0x0 - hence the prototype patch below, and hence
 * `e2e/onboarding.spec.ts` for the half that needs a browser.
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

const FEED = `
  <button data-tour="capture" aria-expanded="false"></button>
  ${PROPS.map((prop) => `<article data-note-feed-id="${prop.id}"></article>`).join('')}
`;

const SETTINGS = `
  <section data-tour="settings-customisation"></section>
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

  // Radix moves `aria-expanded` through React state rather than setting it on
  // the click, which is exactly the lag `setSpeedDialOpen` reads back for.
  document.querySelector('[data-tour="capture"]')?.addEventListener('click', (event) => {
    const trigger = event.currentTarget as HTMLElement;
    calls.push('dial');
    later(() =>
      trigger.setAttribute(
        'aria-expanded',
        String(trigger.getAttribute('aria-expanded') !== 'true')
      )
    );
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
  return document.querySelector('[data-tour="capture"]')?.getAttribute('aria-expanded') === 'true';
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the step list', () => {
  it('is the five steps, in the order the copy is written for', () => {
    // The keys are also the copy's keys (`onboarding.steps.<key>`), so this is
    // the test that fails when a step is renamed in one place only.
    expect(TOUR_STEPS.map((s) => s.key)).toEqual([
      'capture',
      'editor',
      'wall',
      'settings',
      'local',
    ]);
  });
});

describe('step 1, the capture affordance', () => {
  it('opens the speed dial and closes it again', async () => {
    const { stage, calls } = paperApp();

    await step('capture').enter?.(stage);
    expect(dialOpen()).toBe(true);

    await step('capture').exit?.(stage);
    expect(dialOpen()).toBe(false);
    expect(calls).toEqual(['dial', 'dial']);
  });

  it('does not click a dial that is already in the state it wants', async () => {
    const { stage, calls } = paperApp();

    await step('capture').enter?.(stage);
    await step('capture').enter?.(stage);

    expect(calls).toEqual(['dial']);
  });

  it('does nothing at a width that has no dial', async () => {
    // Desktop: the same target name, but a plain bar with no expanded state.
    // The step keeps its spotlight and loses only its act.
    const { stage, calls } = paperApp();
    document.body.innerHTML = '<div data-tour="capture"></div>';

    await step('capture').enter?.(stage);

    expect(calls).toEqual([]);
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

describe('step 4, Settings', () => {
  it('navigates there and waits for the block it points at', async () => {
    const { stage, calls } = paperApp();

    await step('settings').enter?.(stage);

    expect(calls).toEqual(['navigate:/settings']);
    expect(document.querySelector('[data-tour="settings-customisation"]')).not.toBeNull();
  });

  it('retreats by popping history rather than navigating forward again', async () => {
    const { stage, calls } = paperApp();
    await step('settings').enter?.(stage);

    await step('settings').exit?.(stage);

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
  // The contract behind Back: `exit` is an inverse, not a second forward move.
  // A step that left the app somewhere new would make Back a way of walking
  // sideways through the app, and would leave the Tour's own litter behind.
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

  it('changes scene for every move but the one pair that shares a place', () => {
    // Steps 4 and 5 are Settings looked at twice. Exiting step 4 on the way to
    // step 5 would bounce the user back to the Feed and then have to navigate to
    // Settings again, with the whole flash in between.
    expect(changesScene(at('settings'), at('local'))).toBe(false);
    expect(changesScene(at('local'), at('settings'))).toBe(false);

    expect(changesScene(at('capture'), at('editor'))).toBe(true);
    expect(changesScene(at('editor'), at('wall'))).toBe(true);
    expect(changesScene(at('wall'), at('settings'))).toBe(true);
    expect(changesScene(at('settings'), at('wall'))).toBe(true);
  });

  it('unwinds one step when that step is the whole scene', async () => {
    const { stage, calls } = paperApp();
    await step('wall').enter?.(stage);
    calls.length = 0;

    await leaveScene(at('wall'), stage);

    expect(calls).toEqual(['unpin:prop-ideas']);
  });

  it('unwinds the step that opened the scene as well, when ending on a continuation', async () => {
    // Skipping or finishing on step 5 has to undo step 4's navigation, because
    // step 4 is where the scene was entered and step 5 has nothing of its own.
    const { stage, calls } = paperApp();
    await step('settings').enter?.(stage);
    calls.length = 0;

    await leaveScene(at('local'), stage);

    expect(calls).toEqual(['back']);
  });
});

describe('stageRadiusOf', () => {
  // Set as the longhand, not as `border-radius`: jsdom does not expand the
  // shorthand into its four corners, so a shorthand here reads back as 0 and
  // would be testing nothing. Browsers do expand it, which is what the real
  // `rounded-card` and `rounded-full` classes rely on.
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
