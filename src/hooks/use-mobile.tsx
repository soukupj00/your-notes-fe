import { useSyncExternalStore } from 'react';

// ADR 0010: 640, not shadcn's 768. This is Tailwind's `sm:`, the app's single
// nav breakpoint; the two disagreeing left 640-767px with no navigation at all.
const MOBILE_BREAKPOINT = 640;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

// The query, not `window.innerWidth`, so JS and CSS agree: on an Android rotation the window
// metrics can lag the query, and no second event corrects them (ADR 0016).
function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Read synchronously, so a phone never paints the desktop sidebar for a frame first. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
