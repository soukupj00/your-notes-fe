import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * The frame every Settings page shares, the Home included. `settled` marks the Home once the
 * server has answered, which the Tour waits for (CLAUDE.md, Onboarding).
 */
export function SettingsFrame({
  titleKey,
  home = false,
  settled,
  children,
}: {
  titleKey: string;
  home?: boolean;
  settled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl" data-settled={settled || undefined}>
      {/* Below `sm:` the app bar's Back arrow does this. */}
      {!home && (
        <Link
          to="/settings"
          className="mb-2 -ml-2 hidden min-h-11 items-center gap-1.5 rounded-control px-2 text-foreground text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex [&_svg]:size-4"
        >
          <ArrowLeft aria-hidden />
          {t('nav.settings')}
        </Link>
      )}
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
