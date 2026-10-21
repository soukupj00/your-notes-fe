import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountForm } from '@/components/account/AccountForm.tsx';
import { SignOutButton } from '@/components/account/SignOutButton.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * Renders nothing when no Self-hosted Server answered: sync is opt-in (ADR 0018).
 * Signing out erases this Device and is refused while anything is owed (`SignOutButton`).
 */
export function AccountSection() {
  const { t } = useTranslation();
  const { status, session, service, setSession } = useAccount();
  const [signingIn, setSigningIn] = useState(false);

  if (!service || (status !== 'signed-in' && status !== 'signed-out')) return null;

  return (
    <SettingsSection title={t('account.section.title')}>
      {session ? (
        <SettingsRow
          label={t('account.section.signedInLabel', { username: session.username })}
          description={`${t(`account.section.${session.role}`)} · ${t('account.section.thisDevice', { name: session.deviceName })}`}
        >
          <SignOutButton />
        </SettingsRow>
      ) : (
        <SettingsRow
          label={t('account.section.signedOutLabel')}
          description={
            <>
              {t('account.section.signedOutDescription')}
              <a
                href="https://soukupj00.github.io/your-notes-be/setup"
                target="_blank"
                rel="noopener noreferrer"
                className="touch-reach block w-fit underline underline-offset-2 hover:text-foreground"
              >
                {t('account.section.setupGuide')}
              </a>
            </>
          }
        >
          <Button variant="outline" size="sm" onClick={() => setSigningIn(true)}>
            {t('account.section.signIn')}
          </Button>
        </SettingsRow>
      )}

      <Dialog open={signingIn} onOpenChange={setSigningIn}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('account.section.signIn')}</DialogTitle>
            <DialogDescription>{t('account.section.signInDescription')}</DialogDescription>
          </DialogHeader>
          <AccountForm
            credentials="current"
            via="password"
            submitLabel={t('account.section.signIn')}
            onSubmit={async ({ username, password, deviceName }) => {
              setSession(await service.signIn(username, password, deviceName));
              setSigningIn(false);
            }}
            secondary={
              <Button type="button" variant="outline" onClick={() => setSigningIn(false)}>
                {t('account.cancel')}
              </Button>
            }
          />
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
