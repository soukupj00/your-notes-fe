import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { useTour } from '@/context/TourProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/** The only place the Tour starts by hand. */
export function HelpSection() {
  const { t } = useTranslation();
  const { start, active } = useTour();

  return (
    <SettingsSection title={t('settings.help.title')}>
      <SettingsRow
        label={t('settings.help.replay.label')}
        description={t('settings.help.replay.description')}
      >
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={active}
          onClick={start}
        >
          {t('settings.help.replay.action')}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}

export default HelpSection;
