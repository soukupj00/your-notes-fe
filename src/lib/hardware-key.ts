import { TYPES_ITS_KEYS } from './app-shortcut.ts';
import { MODIFIER_KEYS } from './key-combo.ts';

const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Escape',
]);

/**
 * Whether a keydown can only have come from a hardware keyboard (ADR 0028). A software keyboard
 * types only into a field and sends no Ctrl, Cmd or Alt, so a key outside a field or a command
 * key anywhere is proof; IME composition and Android's `Unidentified`/229 never are.
 */
export function isHardwareKey(event: KeyboardEvent, trusted = event.isTrusted): boolean {
  // Autofill can send a keydown with no `key` at all.
  if (typeof event.key !== 'string' || !trusted || event.isComposing) return false;
  if (event.key === 'Unidentified' || event.keyCode === 229) return false;
  if (MODIFIER_KEYS.has(event.key)) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const inField = event.target instanceof Element && event.target.closest(TYPES_ITS_KEYS) !== null;
  return !inField && (event.key.length === 1 || NAVIGATION_KEYS.has(event.key));
}
