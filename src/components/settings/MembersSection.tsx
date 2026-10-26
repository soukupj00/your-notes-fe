import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { accountErrorKey, Field } from '@/components/account/AccountForm.tsx';
import { PairingLinkButton } from '@/components/account/PairingLinkButton.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import type { Member } from '@/data/Remote.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { formatDate, MEDIUM_DATE } from '@/lib/format.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/** The Owner sets a member's password (backend `docs/setup.md` section 10); their Devices stay signed in. */
function ResetPasswordButton({ member }: { member: Member }) {
  const { t } = useTranslation();
  const { service } = useAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    setBusy(true);
    setError(null);
    try {
      await service.resetPassword(member.id, password);
      setOpen(false);
      toast.success(t('account.members.resetDone'));
    } catch (caught) {
      setError(accountErrorKey(caught, 'password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => {
          setPassword('');
          setError(null);
          setOpen(true);
        }}
      >
        {t('account.members.reset')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('account.members.resetTitle', { username: member.username })}
            </DialogTitle>
            <DialogDescription>{t('account.members.resetDescription')}</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field
              label={t('account.members.newPassword')}
              hint={t('account.passwordHint')}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {t(error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('account.cancel')}
              </Button>
              <Button type="submit" disabled={busy} className="gap-1">
                {busy && <Spinner />}
                {t('account.members.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Owner only (backend `docs/setup.md` sections 7 and 10): a member's session would get 403.
 * A member who joins appears on the next visit.
 */
export function MembersSection() {
  const { t, i18n } = useTranslation();
  const { session, service } = useAccount();
  const [members, setMembers] = useState<Member[]>([]);
  const isOwner = session?.role === 'owner';

  useAsyncEffect(
    async (alive) => {
      if (!isOwner || !service) return;
      try {
        const found = await service.accounts();
        if (alive()) setMembers(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [isOwner, service, t]
  );

  if (!isOwner) return null;
  // The Owner alone on the server would be a list of one, themselves.
  const listed = members.some((member) => member.id !== session.accountId) ? members : [];

  return (
    <SettingsSection title={t('account.members.title')}>
      {listed.map((member) => (
        <SettingsRow
          key={member.id}
          label={member.username}
          description={
            member.id === session.accountId
              ? `${t('account.section.owner')} · ${t('account.members.you')}`
              : `${t(`account.section.${member.role}`)} · ${t('account.members.joined', {
                  date: formatDate(member.createdAt, i18n.language, MEDIUM_DATE),
                })}`
          }
        >
          {/* The Owner's own password is reset from the server (setup guide step 10), not here. */}
          {member.id !== session.accountId && <ResetPasswordButton member={member} />}
        </SettingsRow>
      ))}
      <PairingLinkButton kind="invite" label={t('account.members.invite')} />
    </SettingsSection>
  );
}
