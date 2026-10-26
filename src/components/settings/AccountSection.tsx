import { useTranslation } from 'react-i18next';
import { SignOutButton } from '@/components/account/SignOutButton.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * Signed in only: a Device with no account gets `LocalOnlyCard` on the Settings home instead.
 * Signing out erases this Device and is refused while anything is owed (`SignOutButton`).
 */
export function AccountSection() {
  const { t } = useTranslation();
  const { session } = useAccount();

  if (!session) return null;

  return (
    <SettingsSection title={t('account.section.title')}>
      <SettingsRow
        label={t('account.section.signedInLabel', { username: session.username })}
        description={`${t(`account.section.${session.role}`)} · ${t('account.section.thisDevice', { name: session.deviceName })}`}
      >
        <SignOutButton />
      </SettingsRow>
    </SettingsSection>
  );
}
