import * as React from 'react';

// ADR 0010: 640, not shadcn's 768. This is Tailwind's `sm:`, the app's single
// nav breakpoint; the two disagreeing left 640-767px with no navigation at all.
const MOBILE_BREAKPOINT = 640;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile() {
  // Read synchronously on first render (the `ViewModeProvider` pattern). As
  // generated this started `false`, so a phone painted the desktop sidebar
  // branch for a frame before switching to the `Sheet`.
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia(QUERY).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    // The query, not `window.innerWidth`. This listener answers the question the
    // event asked, and it is the same question the stylesheet asks, so JS and
    // CSS cannot disagree about which layout is in effect. Re-measuring the
    // window here could: on an Android rotation the metrics are not guaranteed
    // to have landed by the time the query changes, and there is no second event
    // to correct a wrong answer - which left a rotated phone with the wide
    // toolbar (wrapping, four rows) pinned to the bottom by the correct CSS.
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
