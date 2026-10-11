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
      <SettingsRow
        label={t('settings.help.docs.label')}
        description={t('settings.help.docs.description')}
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <a
              href="https://soukupj00.github.io/your-notes-fe/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('settings.help.docs.open')}
            </a>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <a
              href="https://github.com/soukupj00/your-notes-fe"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('settings.help.docs.github')}
            </a>
          </Button>
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}

export default HelpSection;
