import { comboFromEvent, hasCommandModifier, typesAltGrCharacter } from './key-combo.ts';

/** Where a bare key is typing, not a command. */
const TYPES_ITS_KEYS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Where every key belongs to what is open: an open note, a modal, a menu. */
const OWNS_ITS_KEYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/**
 * Whether a keydown is an app-wide Shortcut (`new-note`, `search`). A combination with Ctrl, Cmd
 * or Alt works from a field, as Ctrl+K always has; a bare key never does.
 */
export function isAppShortcut(event: KeyboardEvent, combo: string | null): boolean {
  if (combo === null || event.repeat || event.defaultPrevented) return false;
  if (comboFromEvent(event) !== combo || typesAltGrCharacter(event)) return false;
  // A modal elsewhere (the launch Welcome) holds the app inert even when focus is on body.
  if (document.querySelector('[aria-modal="true"]')) return false;
  if (!(event.target instanceof Element)) return true;
  if (event.target.closest(OWNS_ITS_KEYS)) return false;
  return hasCommandModifier(combo) || !event.target.closest(TYPES_ITS_KEYS);
}
