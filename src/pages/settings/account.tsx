import { Navigate } from '@tanstack/react-router';
import { AccountSection } from '@/components/settings/AccountSection.tsx';
import { DevicesSection } from '@/components/settings/DevicesSection.tsx';
import { MembersSection } from '@/components/settings/MembersSection.tsx';
import { SharesSection } from '@/components/settings/SharesSection.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function AccountSettingsPage() {
  const { status } = useAccount();

  // Here, not in the route's loader: the status is async React state, and it changes under the
  // page on a sign-out or a server that stops answering, which would strand an empty page.
  if (status === 'checking') return null;
  if (status !== 'signed-in') return <Navigate to="/settings" replace />;

  return (
    <SettingsFrame titleKey="settings.pages.account">
      <AccountSection />
      <DevicesSection />
      <SharesSection />
      <MembersSection />
    </SettingsFrame>
  );
}
