import { afterEach, describe, expect, it, vi } from 'vitest';

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const original = navigator.userAgent;

/** The table reads `navigator` once at import, so each case loads a fresh module. */
async function load(userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  vi.resetModules();
  return import('./shortcut-keys.ts');
}

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
});

describe('getShortcutKeys', () => {
  it.each([
    ['a Mac', MAC, ['⌘', '⌥', '⇧', 'B'], ['Command', 'Option', 'Shift', 'B']],
    ['anything else', WINDOWS, ['Ctrl', 'Alt', 'Shift', 'B'], ['Control', 'Alt', 'Shift', 'B']],
  ])('spells Mod, Alt, Shift and a letter for %s', async (_name, ua, symbols, readable) => {
    const { getShortcutKeys } = await load(ua);

    const parts = getShortcutKeys(['Mod', 'Alt', 'Shift', 'B']);

    expect(parts.map((part) => part.symbol)).toEqual(symbols);
    expect(parts.map((part) => part.readable)).toEqual(readable);
  });
});
