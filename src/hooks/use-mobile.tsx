import * as React from 'react';

// ADR 0010: 640, not shadcn's 768. This is Tailwind's `sm:`, the app's single
// nav breakpoint; the two disagreeing left 640-767px with no navigation at all.
const MOBILE_BREAKPOINT = 640;

export function useIsMobile() {
  // Read synchronously on first render (the `ViewModeProvider` pattern). As
  // generated this started `false`, so a phone painted the desktop sidebar
  // branch for a frame before switching to the `Sheet`.
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < MOBILE_BREAKPOINT);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
