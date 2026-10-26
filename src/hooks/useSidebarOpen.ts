import { useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'sidebar-open';
// Below it the expanded sidebar leaves the Feed header too narrow for one row.
const WIDE = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(WIDE);
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function isWide(): boolean {
  return globalThis.matchMedia?.(WIDE).matches ?? true;
}

function readStored(): boolean | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? null : stored !== 'false';
}

/**
 * Whether the desktop sidebar is expanded: a per-device choice, in `localStorage` (ADR 0010).
 * Until the user makes one it follows the width, rotation included.
 */
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const [stored, setStored] = useState(readStored);
  const wide = useSyncExternalStore(subscribe, isWide, () => true);

  const setOpen = (next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setStored(next);
  };

  return [stored ?? wide, setOpen];
}
