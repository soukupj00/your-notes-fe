import { useSyncExternalStore } from 'react';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { isHardwareKey } from '@/lib/hardware-key.ts';

// `sessionStorage`: a reload keeps it, while a new tab or launch, where the keyboard may be
// detached, starts without (ADR 0028). Storage can be blocked, and then it is memory only.
const STORAGE_KEY = 'hardware-key-seen';
let keySeen = readSeen();
const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setSeen(seen: boolean) {
  keySeen = seen;
  try {
    if (seen) sessionStorage.setItem(STORAGE_KEY, 'true');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  for (const listener of listeners) listener();
}

// Capture phase, so a key handler on the page already sees the press that armed it.
function onKeyDown(event: KeyboardEvent) {
  if (!isHardwareKey(event)) return;
  document.removeEventListener('keydown', onKeyDown, true);
  setSeen(true);
}

function subscribe(onChange: () => void): () => void {
  if (!keySeen) document.addEventListener('keydown', onKeyDown, true);
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** For tests: a fresh session, with no key seen. */
export function forgetHardwareKey() {
  setSeen(false);
  if (listeners.size) document.addEventListener('keydown', onKeyDown, true);
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
