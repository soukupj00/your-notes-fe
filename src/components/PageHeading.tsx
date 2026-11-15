import type { ReactNode } from 'react';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * A page's `h1` and its focus target on arrival. Below `sm:` the topbar carries the title, but the
 * heading stays in the DOM: a title in the bar would move focus above `#main-content` and strand
 * the skip link.
 */
export function PageHeading({ children }: { children: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className="sr-only sm:not-sr-only sm:mb-6 sm:font-semibold sm:text-2xl sm:focus-visible:outline-none"
    >
      {children}
    </h1>
  );
}
