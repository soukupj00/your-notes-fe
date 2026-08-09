import { afterEach, describe, expect, it } from 'vitest';
import { noteCardTarget, resolveTourTarget, tourTargetSelector } from './targets.ts';

/**
 * jsdom measures nothing - every element reports a 0x0 rect and no CSS is
 * applied - so the rects are stubbed per element here. That is the whole reason
 * `e2e/tour-targets.spec.ts` exists as well: this file proves the resolver picks
 * the element it is told is visible, and only a real browser can say which one
 * that actually is.
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
    // Not an error: a step whose target is absent is dropped from the run, so
    // the counter never promises a step the user will not be shown.
    render('<div data-tour="capture"></div>');
    measure(document.querySelector('[data-tour="capture"]')!, false);

    expect(resolveTourTarget('capture')).toBeNull();
  });

  it('returns null when nothing carries the attribute at all', () => {
    render('<div></div>');

    expect(resolveTourTarget('editorToolbar')).toBeNull();
  });

  it('resolves a selector computed at run time, which is how step 3 finds its card', () => {
    const id = '0f8c6b1e-1d64-4a2f-9c31-0d2a2f4c8b77';
    render(`<li data-note-feed-id="${id}"></li>`);
    measure(document.querySelector('li')!, true);

    expect(resolveTourTarget(noteCardTarget(id))).toBe(document.querySelector('li'));
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

describe('tourTargetSelector', () => {
  it('escapes an id rather than interpolating it raw', () => {
    // Note ids are uuids today, but a selector built by string concatenation is
    // one schema change away from being unparseable.
    expect(tourTargetSelector(noteCardTarget('a"b'))).toBe('[data-note-feed-id="a\\"b"]');
  });
});
