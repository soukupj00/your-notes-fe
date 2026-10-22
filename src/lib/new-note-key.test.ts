import { afterEach, describe, expect, it } from 'vitest';
import { isNewNoteKey } from './new-note-key.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Dispatches a real keydown from `html`'s `#target`, so `event.target` is what a browser sets. */
function fire(
  html: string,
  init: KeyboardEventInit,
  { key = 'n' as string | null, prevented = false } = {}
) {
  document.body.innerHTML = html;
  const target = document.getElementById('target') ?? document.body;
  if (prevented) target.addEventListener('keydown', (event) => event.preventDefault());
  let result: boolean | undefined;
  document.addEventListener('keydown', (event) => {
    result = isNewNoteKey(event, key);
  });
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  return result;
}

describe('isNewNoteKey', () => {
  it.each([
    ['n on the page', '<div id="target"></div>', { key: 'n' }],
    ['N, with Shift or Caps Lock', '<div id="target"></div>', { key: 'N', shiftKey: true }],
    ['n on a focused button', '<button id="target">x</button>', { key: 'n' }],
  ])('fires for %s', (_label, html, init) => {
    expect(fire(html, init)).toBe(true);
  });

  it('follows a remapped key', () => {
    expect(fire('<div id="target"></div>', { key: 'k' }, { key: 'k' })).toBe(true);
    expect(fire('<div id="target"></div>', { key: 'n' }, { key: 'k' })).toBe(false);
  });

  it.each([
    ['another key', '<div id="target"></div>', { key: 'm' }],
    ['Ctrl', '<div id="target"></div>', { key: 'n', ctrlKey: true }],
    ['Cmd', '<div id="target"></div>', { key: 'n', metaKey: true }],
    ['Alt', '<div id="target"></div>', { key: 'n', altKey: true }],
    ['an auto-repeat', '<div id="target"></div>', { key: 'n', repeat: true }],
    ['an input', '<input id="target" />', { key: 'n' }],
    ['a textarea', '<textarea id="target"></textarea>', { key: 'n' }],
    ['a select', '<select id="target"></select>', { key: 'n' }],
    ['a contenteditable', '<div contenteditable="true"><p id="target">x</p></div>', { key: 'n' }],
    ['a dialog', '<div role="dialog"><button id="target">x</button></div>', { key: 'n' }],
    ['an alert dialog', '<div role="alertdialog"><div id="target"></div></div>', { key: 'n' }],
    ['a menu', '<div role="menu"><div id="target" role="menuitem"></div></div>', { key: 'n' }],
    ['a listbox', '<div role="listbox"><div id="target" role="option"></div></div>', { key: 'n' }],
    // The launch Welcome holds the app inert, and a click on its scrim leaves focus on body.
    [
      'a modal open elsewhere',
      '<div role="dialog" aria-modal="true"></div><div id="target"></div>',
      { key: 'n' },
    ],
  ])('ignores %s', (_label, html, init) => {
    expect(fire(html, init)).toBe(false);
  });

  it('ignores a keydown something else already handled', () => {
    expect(fire('<div id="target"></div>', { key: 'n' }, { prevented: true })).toBe(false);
  });

  it('never fires while the key is off', () => {
    expect(fire('<div id="target"></div>', { key: 'n' }, { key: null })).toBe(false);
  });
});
