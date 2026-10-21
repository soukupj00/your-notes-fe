import { afterEach, describe, expect, it } from 'vitest';
import { resolveTourTarget } from './targets.ts';

/**
 * jsdom measures every element as 0x0, so rects are stubbed per element. This proves the resolver
 * picks the element it is told is visible; `e2e/onboarding.spec.ts` proves which one really is.
 */
function measure(element: Element, visible: boolean) {
  element.getBoundingClientRect = () =>
    ({ width: visible ? 120 : 0, height: visible ? 44 : 0 }) as DOMRect;
}

function render(html: string) {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveTourTarget', () => {
  it('skips a match that measures nothing and takes the one that does', () => {
    // The real case: `DesktopCaptureBar` is `hidden sm:flex` and
    // `QuickCaptureBar` is `sm:hidden`, so both carry the attribute at every
    // width and exactly one of them is on screen.
    render(
      '<div id="desktop" data-tour="capture"></div><div id="mobile" data-tour="capture"></div>'
    );
    measure(document.querySelector('#desktop')!, false);
    measure(document.querySelector('#mobile')!, true);

    expect(resolveTourTarget('capture')?.id).toBe('mobile');
  });

  it('takes the first visible match when document order is the only difference', () => {
    render('<div id="a" data-tour="capture"></div><div id="b" data-tour="capture"></div>');
    measure(document.querySelector('#a')!, true);
    measure(document.querySelector('#b')!, true);

    expect(resolveTourTarget('capture')?.id).toBe('a');
  });

  it('returns null when every match is hidden', () => {
    // Not an error: a step whose target is absent is shown without a cutout.
    render('<div data-tour="capture"></div>');
    measure(document.querySelector('[data-tour="capture"]')!, false);

    expect(resolveTourTarget('capture')).toBeNull();
  });

  it('returns null when nothing carries the attribute at all', () => {
    render('<div></div>');

    expect(resolveTourTarget('settingsSync')).toBeNull();
  });

  it('searches within the root it is given', () => {
    render(
      '<div id="outside" data-tour="capture"></div><main><div id="inside" data-tour="capture"></div></main>'
    );
    measure(document.querySelector('#outside')!, true);
    measure(document.querySelector('#inside')!, true);

    expect(resolveTourTarget('capture', document.querySelector('main')!)?.id).toBe('inside');
  });
});
