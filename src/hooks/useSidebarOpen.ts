import { useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

const STORAGE_KEY = 'sidebar-open';
// Below it the expanded sidebar leaves the Feed header too narrow for one row.
const WIDE = '(min-width: 1024px)';

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
  const wide = useMediaQuery(WIDE, true);

  const setOpen = (next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setStored(next);
  };

  return [stored ?? wide, setOpen];
}
