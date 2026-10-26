import { BackupSection } from '@/components/settings/BackupSection.tsx';
import { SyncStatusSection } from '@/components/settings/SyncStatusSection.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function DataSettingsPage() {
  const { status } = useAccount();

  return (
    <SettingsSubpage
      titleKey={status === 'signed-in' ? 'settings.pages.dataSync' : 'settings.pages.dataLocal'}
    >
      <SyncStatusSection />
      <BackupSection />
    </SettingsSubpage>
  );
}
