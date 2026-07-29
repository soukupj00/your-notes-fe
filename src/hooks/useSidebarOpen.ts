import { useState } from 'react';

const STORAGE_KEY = 'sidebar-open';

/**
 * Whether the desktop sidebar is expanded, persisted to localStorage.
 *
 * Read synchronously in the `useState` initialiser (same pattern as
 * `ViewModeProvider`) rather than from the Dexie preferences blob: that store
 * hydrates asynchronously, so the sidebar would paint at 16rem and snap to 3rem
 * a frame later, shoving the feed sideways. Collapse is also a per-device
 * choice, so it deliberately does not sync (ADR 0010).
 */
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(
    // Default open: anything other than an explicit "false" means expanded.
    () => localStorage.getItem(STORAGE_KEY) !== 'false'
  );

  const setOpen = (next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setOpenState(next);
  };

  return [open, setOpen];
}
