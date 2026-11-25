import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const SETTINGS_ACTION_ROW =
  'flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left text-sm hover:bg-accent -outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

export function NewTabRow({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={SETTINGS_ACTION_ROW}>
      {icon}
      <span className="flex-1">{children}</span>
      <ExternalLink aria-hidden className="size-4!" />
      <span className="sr-only"> {t('nav.newTab')}</span>
    </a>
  );
}
