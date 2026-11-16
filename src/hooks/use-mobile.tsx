import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

// ADR 0010: 640, not shadcn's 768. This is Tailwind's `sm:`, the app's single
// nav breakpoint; the two disagreeing left 640-767px with no navigation at all.
const MOBILE_BREAKPOINT = 640;

/**
 * Read synchronously, so a phone never paints the desktop sidebar for a frame first. The query,
 * not `window.innerWidth`, so JS and CSS agree: on an Android rotation the window metrics can lag
 * the query, and no second event corrects them (ADR 0016).
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
