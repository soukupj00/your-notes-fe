import { afterEach, describe, expect, it } from 'vitest';
import { isAppShortcut } from './app-shortcut.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Dispatches a real keydown from `html`'s `#target`, so `event.target` is what a browser sets. */
function fire(
  html: string,
  init: KeyboardEventInit & { keyCode?: number },
  { combo = 'n' as string | null, prevented = false } = {}
) {
  document.body.innerHTML = html;
  const target = document.getElementById('target') ?? document.body;
  if (prevented) target.addEventListener('keydown', (event) => event.preventDefault());
  let result: boolean | undefined;
  document.addEventListener('keydown', (event) => {
    result = isAppShortcut(event, combo);
  });
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  // jsdom leaves `keyCode` at 0; the canonical name reads it for a key held with a modifier.
  Object.defineProperty(event, 'keyCode', { value: init.keyCode ?? 0 });
  target.dispatchEvent(event);
  return result;
}

const page = '<div id="target"></div>';
const ctrlK = { key: 'k', keyCode: 75, ctrlKey: true };

describe('isAppShortcut', () => {
  it.each([
    ['n on the page', page, { key: 'n' }, 'n'],
    ['N, with Shift or Caps Lock', page, { key: 'N', shiftKey: true }, 'n'],
    ['n on a focused button', '<button id="target">x</button>', { key: 'n' }, 'n'],
    ['Ctrl+K on the page', page, ctrlK, 'Mod-k'],
    ['Ctrl+K in the search box', '<input id="target" type="search" />', ctrlK, 'Mod-k'],
    ['a remapped bare key', page, { key: '/' }, '/'],
  ])('fires for %s', (_label, html, init, combo) => {
    expect(fire(html, init, { combo })).toBe(true);
  });

  it.each([
    ['another key', page, { key: 'm' }, 'n'],
    ['Ctrl+N for the key n', page, { key: 'n', keyCode: 78, ctrlKey: true }, 'n'],
    ['Cmd+N for the key n', page, { key: 'n', keyCode: 78, metaKey: true }, 'n'],
    ['Alt+N for the key n', page, { key: 'n', keyCode: 78, altKey: true }, 'n'],
    ['an auto-repeat', page, { key: 'n', repeat: true }, 'n'],
    ['a bare key in an input', '<input id="target" />', { key: 'n' }, 'n'],
    ['a bare / in the search box', '<input id="target" type="search" />', { key: '/' }, '/'],
    ['a bare key in a textarea', '<textarea id="target"></textarea>', { key: 'n' }, 'n'],
    ['a bare key in a select', '<select id="target"></select>', { key: 'n' }, 'n'],
    [
      'a bare key in a contenteditable',
      '<div contenteditable="true"><p id="target">x</p></div>',
      { key: 'n' },
      'n',
    ],
    ['a dialog', '<div role="dialog"><button id="target">x</button></div>', { key: 'n' }, 'n'],
    [
      'Ctrl+K in an open note',
      '<div role="dialog"><div contenteditable="true"><p id="target">x</p></div></div>',
      ctrlK,
      'Mod-k',
    ],
    ['an alert dialog', '<div role="alertdialog"><div id="target"></div></div>', { key: 'n' }, 'n'],
    ['a menu', '<div role="menu"><div id="target" role="menuitem"></div></div>', { key: 'n' }, 'n'],
    [
      'a listbox',
      '<div role="listbox"><div id="target" role="option"></div></div>',
      { key: 'n' },
      'n',
    ],
    // The launch Welcome holds the app inert, and a click on its scrim leaves focus on body.
    [
      'a modal open elsewhere',
      '<div role="dialog" aria-modal="true"></div><div id="target"></div>',
      ctrlK,
      'Mod-k',
    ],
  ])('ignores %s', (_label, html, init, combo) => {
    expect(fire(html, init, { combo })).toBe(false);
  });

  it('ignores a keydown something else already handled', () => {
    expect(fire(page, { key: 'n' }, { prevented: true })).toBe(false);
  });

  it('never fires while the Shortcut is cleared', () => {
    expect(fire(page, { key: 'n' }, { combo: null })).toBe(false);
  });
});
