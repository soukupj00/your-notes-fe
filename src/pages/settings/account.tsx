import { AccountSection } from '@/components/settings/AccountSection.tsx';
import { DevicesSection } from '@/components/settings/DevicesSection.tsx';
import { MembersSection } from '@/components/settings/MembersSection.tsx';
import { SharesSection } from '@/components/settings/SharesSection.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function AccountSettingsPage() {
  return (
    <SettingsSubpage titleKey="settings.pages.account">
      <AccountSection />
      <DevicesSection />
      <SharesSection />
      <MembersSection />
    </SettingsSubpage>
  );
}
