import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stageRadiusOf, TOUR_STEPS, type TourStep } from './steps.ts';

// jsdom measures 0x0, hence the rect patch below and `e2e/onboarding.spec.ts` for whatever needs a
// real browser.

beforeAll(() => {
  // Connected means visible. `resolveTourTarget` skips anything measuring
  // nothing, which in unpatched jsdom is every element in the document.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const size = this.isConnected ? 120 : 0;
    return { width: size, height: size } as DOMRect;
  };
});

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

describe('the step targets', () => {
  // The three Home rows always render, so no step has a run without a cutout.
  it.each([
    ['toolbar', 'settingsToolbar'],
    ['quickCapture', 'settingsQuickCapture'],
    ['sync', 'settingsSync'],
  ])('points %s at its Home row', (key, target) => {
    expect(step(key).target()).toBe(target);
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
