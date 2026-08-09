import { useSyncExternalStore } from 'react';

const QUERY = '(pointer: fine)';

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(QUERY);
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return globalThis.matchMedia?.(QUERY).matches ?? false;
}

/**
 * Whether the primary pointer is a mouse or trackpad - in practice, whether this
 * is a desktop.
 *
 * The inverse of the signal behind DESIGN.md's 44px Touch Rule, and deliberately
 * the same one: `pointer: coarse` is what widens a control for a thumb, so
 * `pointer: fine` is what narrows the audience for a keyboard hint. A phone and
 * a tablet both report coarse; only a machine with a pointing device reports
 * fine, and only that machine has the modifier keys a shortcut names.
 *
 * Not a viewport width. A desktop window dragged narrow still has a keyboard, and
 * a tablet in landscape still has none, so width would answer a different
 * question than the one being asked.
 *
 * Defaults to `false` where it cannot be measured, which suppresses the hint
 * rather than showing an unusable one.
 *
 * `useSyncExternalStore` rather than an effect, for the reason given in
 * `useReducedMotion`: a media query is the external store it exists for.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
