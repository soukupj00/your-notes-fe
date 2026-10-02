import * as React from 'react';

// ADR 0010: 640, not shadcn's 768. This is Tailwind's `sm:`, the app's single
// nav breakpoint; the two disagreeing left 640-767px with no navigation at all.
const MOBILE_BREAKPOINT = 640;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile() {
  // Read synchronously so a phone never paints the desktop sidebar for a frame first.
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia(QUERY).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    // The query, not `window.innerWidth`, so JS and CSS agree: on an Android rotation the
    // window metrics can lag the query, and no second event corrects them (ADR 0016).
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
