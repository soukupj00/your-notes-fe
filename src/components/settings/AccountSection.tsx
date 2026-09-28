import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AccountForm } from '@/components/account/AccountForm.tsx';
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
 * Who this Device is signed in as, or a way to sign in. Renders nothing when no
 * Self-hosted Server answered, because sync is opt-in and a local-only app has
 * no account to talk about (ADR 0018).
 *
 * Sign out only ends the session. Erasing this Device's Notes on sign-out is
 * M5 slice 4, together with the push that makes it safe.
 */
export function AccountSection() {
  const { t } = useTranslation();
  const { status, session, service, setSession } = useAccount();
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!service || (status !== 'signed-in' && status !== 'signed-out')) return null;

  const signOut = async () => {
    setBusy(true);
    try {
      await service.signOut();
      setSession(null);
      toast.success(t('account.section.signedOut'));
    } catch {
      toast.error(t('account.errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={t('account.section.title')}>
      {session ? (
        <SettingsRow
          label={t('account.section.signedInLabel', { username: session.username })}
          description={`${t(`account.section.${session.role}`)} · ${t('account.section.thisDevice', { name: session.deviceName })}`}
        >
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void signOut()}>
            {t('account.section.signOut')}
          </Button>
        </SettingsRow>
      ) : (
        <SettingsRow
          label={t('account.section.signedOutLabel')}
          description={t('account.section.signedOutDescription')}
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
