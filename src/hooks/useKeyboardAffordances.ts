import { useSyncExternalStore } from 'react';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { isHardwareKey } from '@/lib/hardware-key.ts';

// Session-only: a detached keyboard should not leave hints behind across launches (ADR 0028).
let keySeen = false;
const listeners = new Set<() => void>();

// Capture phase, so a key handler on the page already sees the press that armed it.
function onKeyDown(event: KeyboardEvent) {
  if (!isHardwareKey(event)) return;
  keySeen = true;
  document.removeEventListener('keydown', onKeyDown, true);
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  if (!keySeen) document.addEventListener('keydown', onKeyDown, true);
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** For a key handler, which runs before the arming press has re-rendered anything. */
export function hardwareKeySeen(): boolean {
  return keySeen;
}

/**
 * Whether to offer keyboard hints, keys and the Shortcuts page: a Fine pointer, or a hardware
 * key pressed this session (ADR 0028). Layout never reads this, nor does the Width Class.
 */
export function useKeyboardAffordances(): boolean {
  const finePointer = useFinePointer();
  const seen = useSyncExternalStore(subscribe, hardwareKeySeen, () => false);
  return finePointer || seen;
}
