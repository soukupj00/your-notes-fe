import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/** The frame every Settings page shares, the Home included. */
export function SettingsSubpage({ titleKey, children }: { titleKey: string; children: ReactNode }) {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hidden on mobile, where the topbar carries the title, but always in the DOM: it is the
          route's focus target and outline. A title in the bar would move focus above
          `#main-content` and strand the skip link. */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="sr-only sm:not-sr-only sm:mb-6 sm:font-semibold sm:text-2xl sm:focus-visible:outline-none"
      >
        {t(titleKey)}
      </h1>
      {children}
    </div>
  );
}
