/** Where a bare letter is typing or picking, not a command: fields, the editor, modals and menus. */
const OWNS_ITS_KEYS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/**
 * Whether a keydown is the new-note key. Matched on `event.key`, so it follows the keyboard
 * layout and ignores Shift and Caps Lock; Ctrl, Cmd and Alt leave the combination to the browser.
 */
export function isNewNoteKey(event: KeyboardEvent, key: string | null): boolean {
  if (key === null || event.key.toLowerCase() !== key.toLowerCase()) return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.defaultPrevented) {
    return false;
  }
  return !(event.target instanceof Element && event.target.closest(OWNS_ITS_KEYS));
}
