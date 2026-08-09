import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { useTour } from '@/context/TourProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * The way back into the Tour, and the only place it can be started by hand.
 *
 * It sits after `ShortcutsSection` because that is where "learn the app" already
 * lives, and because it leaves `PwaInstallSection` + `BackupSection` as the
 * closing pair the Tour's last step spotlights.
 *
 * Replay is not a second, shorter Tour: it is the same five steps on a fresh set
 * of Props, which is why the row does nothing but call `start`. The Tour itself
 * takes care of getting back to the Feed - the first three steps are about the
 * wall, and this button is pressed from Settings.
 */
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
