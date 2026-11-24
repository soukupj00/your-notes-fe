import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Holds focus off the page while a Note's dialog, or the loading fallback, hides it, and hands
 * focus back to the opener on close. Radix hides the page before it moves focus in, and Chrome
 * ignores an aria-hidden set over focus for the rest of the page load.
 */
export function useOpenerFocus(open: boolean) {
  const openerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    openerRef.current = null;
    if (inNoteDialog(document.activeElement)) return;
    const holdOff = (element: EventTarget | null) => {
      if (!(element instanceof HTMLElement) || element === document.body) return;
      openerRef.current = element;
      element.blur();
    };
    // A menu that opened the Note hands focus back to its trigger a task after it closes.
    const onFocusIn = (event: FocusEvent) => {
      if (inNoteDialog(event.target)) document.removeEventListener('focusin', onFocusIn);
      else holdOff(event.target);
    };
    holdOff(document.activeElement);
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [open]);

  return useCallback(() => openerRef.current?.focus({ preventScroll: true }), []);
}

/** Not `role=dialog`: the dial's menu is one, and it holds focus as the Note opens. */
function inNoteDialog(target: EventTarget | null) {
  return target instanceof Element && target.closest('[data-slot=dialog-content]') !== null;
}
