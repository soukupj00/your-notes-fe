import { describe, expect, it } from 'vitest';
import { sanitizeDrawingPreview } from './drawing-preview.ts';

const PICTURE =
  '<symbol id="image-1"><image href="data:image/png;base64,iVBORw0KGgo=" width="100%" height="100%"/></symbol>';

/** The shape Excalidraw exports for a picture: drawn once as a symbol, placed with `<use>`. */
const svg = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs>${defs}</defs>${body}</svg>`;

const uses = (markup: string) => {
  const host = document.createElement('div');
  host.innerHTML = sanitizeDrawingPreview(markup);
  return [...host.querySelectorAll('use')].map(
    (use) => use.getAttribute('href') ?? use.getAttribute('xlink:href')
  );
};

describe('sanitizeDrawingPreview', () => {
  it.each(['href', 'xlink:href'])('keeps a picture placed with `%s` to its symbol', (name) => {
    expect(uses(svg(PICTURE, `<g><use ${name}="#image-1" width="90" height="60"/></g>`))).toEqual([
      '#image-1',
    ]);
  });

  it.each([
    ['another document', 'https://example.com/sprite.svg#icon'],
    ['a data URL', 'data:image/svg+xml,<svg onload="alert(1)"/>'],
    ['a same-origin file', '/api/blobs/x#icon'],
    ['an id outside this SVG', '#image-elsewhere'],
  ])('drops a `<use>` that reaches %s', (_, href) => {
    for (const name of ['href', 'xlink:href']) {
      expect(uses(svg(PICTURE, `<use ${name}="${href}"/>`))).toEqual([]);
    }
  });

  it('drops a `<use>` of anything but a symbol of pictures, so no chain of clones can grow', () => {
    const chain = svg(
      '<g id="a"><rect width="1" height="1"/></g><g id="b"><use href="#a"/><use href="#a"/></g>' +
        '<symbol id="nested"><use href="#image-1"/></symbol>' +
        PICTURE,
      '<use href="#a"/><use href="#b"/><use href="#nested"/><use href="#image-1"/>'
    );
    expect(uses(chain)).toEqual(['#image-1']);
  });

  it('still strips script', () => {
    const markup = sanitizeDrawingPreview(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script></svg>'
    );
    expect(markup).not.toMatch(/onload|script/);
  });
});
