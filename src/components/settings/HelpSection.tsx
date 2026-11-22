import { BookOpen, CirclePlay } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTour } from '@/context/TourProvider.tsx';
import { NewTabRow, SETTINGS_ACTION_ROW } from './SettingsActionRow.tsx';
import { SettingsSection } from './SettingsSection.tsx';

/** The only place the Tour starts by hand. */
export function HelpSection() {
  const { t } = useTranslation();
  const { start, active } = useTour();

  return (
    <SettingsSection title={t('settings.help.title')}>
      <button type="button" className={SETTINGS_ACTION_ROW} disabled={active} onClick={start}>
        <CirclePlay aria-hidden />
        <span className="flex-1">{t('settings.help.replay.action')}</span>
      </button>
      <NewTabRow href={t('settings.help.docs.url')} icon={<BookOpen aria-hidden />}>
        {t('settings.help.docs.label')}
      </NewTabRow>
    </SettingsSection>
  );
}

export default HelpSection;
