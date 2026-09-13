import { afterEach, describe, expect, it, vi } from 'vitest';
import { pointOverText } from './point-over-text';

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom }) as DOMRect;

/** jsdom lays nothing out and its Range has no `getClientRects` at all, so the
 *  text's line boxes are defined per test. */
const layText = (...rects: DOMRect[]) => {
  Range.prototype.getClientRects = vi.fn(() => rects as unknown as DOMRectList);
};

afterEach(() => {
  // @ts-expect-error restoring jsdom's absence of the method
  Range.prototype.getClientRects = undefined;
});

describe('pointOverText', () => {
  const container = () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Milk</p>';
    return div;
  };

  it('is true inside one of the text’s line boxes', () => {
    layText(rect(0, 0, 40, 20));
    expect(pointOverText(container(), 10, 10)).toBe(true);
  });

  it('is false in the empty space after the text, even inside the same block', () => {
    layText(rect(0, 0, 40, 20));
    expect(pointOverText(container(), 200, 10)).toBe(false);
  });

  it('checks every line of wrapped text', () => {
    layText(rect(0, 0, 100, 20), rect(0, 20, 30, 40));
    expect(pointOverText(container(), 10, 30)).toBe(true);
    expect(pointOverText(container(), 60, 30)).toBe(false);
  });

  it('is false for a container with no text', () => {
    layText(rect(0, 0, 100, 20));
    expect(pointOverText(document.createElement('div'), 10, 10)).toBe(false);
  });
});
