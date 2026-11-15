import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '@/components/PageHeading.tsx';

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
      <PageHeading>{t(titleKey)}</PageHeading>
      {children}
    </div>
  );
}
