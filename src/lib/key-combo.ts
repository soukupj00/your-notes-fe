import { base } from 'w3c-keyname';
import { getShortcutKeys, IS_MAC, IS_WINDOWS } from './shortcut-keys.ts';

/**
 * One name for a key combination, shared by the recorder and every matcher (ADR 0026):
 * `Mod-Shift-8`, `Mod-b`, `n`. `Mod` is Cmd on a Mac and Ctrl elsewhere.
 */

export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'keyCode' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
>;

export interface KeyPlatform {
  mac: boolean;
  windows: boolean;
}

export const PLATFORM: KeyPlatform = { mac: IS_MAC, windows: IS_WINDOWS };

/** What a held modifier sends on its own; recording waits past it for the key itself. */
export const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock']);

const ASCII_LETTER = /^[a-z]$/i;

/**
 * Letters follow the printed layout; with a modifier held anything else is named by its
 * physical key, so Ctrl+ě on a Czech keyboard is `Mod-2` and still fires on a US layout.
 * A bare key ignores Shift and Caps Lock. `null` for a modifier pressed alone.
 */
export function comboFromEvent(event: KeyEventLike, platform = PLATFORM): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const command = event.ctrlKey || event.metaKey || event.altKey;
  const key = ASCII_LETTER.test(event.key)
    ? event.key.toLowerCase()
    : command
      ? (base[event.keyCode] ?? event.key)
      : event.key;

  const parts: string[] = [];
  if (platform.mac ? event.metaKey : event.ctrlKey) parts.push('Mod');
  if (platform.mac && event.ctrlKey) parts.push('Ctrl');
  if (!platform.mac && event.metaKey) parts.push('Meta');
  if (event.altKey) parts.push('Alt');
  if (command && event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('-');
}

/**
 * On Windows Ctrl+Alt is AltGr: a press that typed a character, or started an accent as a dead
 * key, is typing, never a shortcut.
 */
export function typesAltGrCharacter(event: KeyEventLike, platform = PLATFORM): boolean {
  if (!platform.windows || !event.ctrlKey || !event.altKey) return false;
  if (event.key === 'Dead') return true;
  return event.key.length === 1 && event.key.toLowerCase() !== base[event.keyCode];
}

/** `Mod-Shift-8` as `['Mod', 'Shift', '8']`, a letter upper-cased for display; `Mod--` is Mod and minus. */
export function comboParts(combo: string): string[] {
  const split = combo.length > 1 ? combo.lastIndexOf('-', combo.length - 2) : -1;
  const key = combo.slice(split + 1);
  const modifiers = split < 0 ? [] : combo.slice(0, split).split('-');
  return [...modifiers, key.length === 1 ? key.toUpperCase() : key];
}

export function hasCommandModifier(combo: string): boolean {
  return comboParts(combo)
    .slice(0, -1)
    .some((part) => part !== 'Shift');
}

const ARIA_NAMES: Record<string, string> = {
  ' ': 'Space',
  Ctrl: 'Control',
  Meta: 'Meta',
  Alt: 'Alt',
  Shift: 'Shift',
};

/** The `aria-keyshortcuts` spelling: `Control+Alt+N`. */
export function ariaKeyShortcuts(combo: string, platform = PLATFORM): string {
  return comboParts(combo)
    .map((part) =>
      part === 'Mod' ? (platform.mac ? 'Meta' : 'Control') : (ARIA_NAMES[part] ?? part)
    )
    .join('+');
}

/** As a tooltip and a hint draw it: `Ctrl + Alt + N`, `⌘ + B` on a Mac. */
export function comboLabel(combo: string): string {
  return getShortcutKeys(comboParts(combo))
    .map((key) => key.symbol)
    .join(' + ');
}
