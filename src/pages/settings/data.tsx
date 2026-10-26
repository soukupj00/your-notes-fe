import { useTranslation } from 'react-i18next';
import { BackupSection } from '@/components/settings/BackupSection.tsx';
import { StorageSection, SyncSection } from '@/components/settings/SyncSection.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function DataSettingsPage() {
  const { t } = useTranslation();
  const { status } = useAccount();
  const local = status === 'unavailable' || status === 'signed-out';

  return (
    <SettingsSubpage
      titleKey={status === 'signed-in' ? 'settings.pages.dataSync' : 'settings.pages.dataLocal'}
    >
      <SyncSection />
      <StorageSection />
      <BackupSection />
      {local && (
        <p className="-mt-4 px-1 text-muted-foreground text-xs">
          {t('settings.backup.localFootnote')}
        </p>
      )}
    </SettingsSubpage>
  );
}
