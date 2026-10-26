import { BookOpen, CirclePlay, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTour } from '@/context/TourProvider.tsx';
import { SettingsSection } from './SettingsSection.tsx';

const ROW =
  'flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

/** The only place the Tour starts by hand. */
export function HelpSection() {
  const { t } = useTranslation();
  const { start, active } = useTour();

  return (
    <SettingsSection title={t('settings.help.title')}>
      <button type="button" className={ROW} disabled={active} onClick={start}>
        <CirclePlay aria-hidden />
        <span className="flex-1">{t('settings.help.replay.action')}</span>
      </button>
      <a
        href="https://soukupj00.github.io/your-notes-fe/"
        target="_blank"
        rel="noopener noreferrer"
        className={ROW}
      >
        <BookOpen aria-hidden />
        <span className="flex-1">{t('settings.help.docs.label')}</span>
        <ExternalLink aria-hidden className="size-4!" />
        <span className="sr-only">{t('nav.newTab')}</span>
      </a>
    </SettingsSection>
  );
}

export default HelpSection;
