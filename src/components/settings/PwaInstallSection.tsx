import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { usePwaInstall } from '@/context/PwaInstallProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/** Browser-gated app installation control. Unsupported and installed browsers see nothing. */
export function PwaInstallSection() {
  const { t } = useTranslation();
  const { canInstall, install } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <SettingsSection title={t('pwa.install.title')}>
      <SettingsRow label={t('pwa.install.label')} description={t('pwa.install.description')}>
        <Button type="button" variant="outline" size="sm" onClick={() => void install()}>
          {t('pwa.install.action')}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
