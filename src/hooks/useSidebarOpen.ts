import { useState } from 'react';

const STORAGE_KEY = 'sidebar-open';

/** Whether the desktop sidebar is expanded: a per-device choice, in `localStorage` (ADR 0010). */
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) !== 'false'
  );

  const setOpen = (next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    setOpenState(next);
  };

  return [open, setOpen];
}
