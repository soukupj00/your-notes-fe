import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { usePwaInstall } from '@/context/PwaInstallProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/** An installed app sees nothing; a browser with no install prompt gets its own steps instead. */
export function PwaInstallSection() {
  const { t } = useTranslation();
  const { canInstall, manualInstall, install } = usePwaInstall();

  if (!canInstall && !manualInstall) return null;

  return (
    <SettingsSection>
      <SettingsRow
        label={t('pwa.install.label')}
        description={
          canInstall ? t('pwa.install.description') : t(`pwa.install.manual.${manualInstall}`)
        }
      >
        {canInstall ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void install()}
          >
            {t('pwa.install.action')}
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <a
              href="https://soukupj00.github.io/your-notes-fe/get-the-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('pwa.install.guide')}
            </a>
          </Button>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
