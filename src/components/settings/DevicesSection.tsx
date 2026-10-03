import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PairingLinkButton } from '@/components/account/PairingLinkButton.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import type { Device } from '@/data/Remote.ts';
import { useAction } from '@/hooks/useAction.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

const lastSeen = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Removing a Device signs it out and changes nothing else (backend `docs/setup.md`
 * section 6). This Device signs out from the Account section instead.
 */
export function DevicesSection() {
  const { t } = useTranslation();
  const { session, service } = useAccount();
  const [devices, setDevices] = useState<Device[]>([]);
  const [removing, setRemoving] = useState<Device | null>(null);
  const { run } = useAction();

  const load = useCallback(
    async (alive: () => boolean = () => true) => {
      if (!service) return;
      try {
        const found = await service.devices();
        if (alive()) setDevices(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [service, t]
  );

  // Once per signed-in session: another Device's pairing shows up on the next visit.
  const accountId = session?.accountId;
  useAsyncEffect(
    (alive) => {
      if (accountId) return load(alive);
    },
    [accountId, load]
  );

  if (!session || !service) return null;

  const remove = async (device: Device) => {
    await run(() => service.revokeDevice(device.id), { success: 'account.devices.removed' });
    await load();
  };

  return (
    <SettingsSection title={t('account.devices.title')}>
      {devices.map((device) => (
        <SettingsRow
          key={device.id}
          label={device.name}
          description={
            device.current
              ? t('account.devices.current')
              : t('account.devices.lastSeen', {
                  date: lastSeen.format(new Date(device.lastSeenAt)),
                })
          }
        >
          {!device.current && (
            <Button variant="outline" size="sm" onClick={() => setRemoving(device)}>
              {t('account.devices.remove')}
            </Button>
          )}
        </SettingsRow>
      ))}
      <SettingsRow
        label={t('account.devices.add')}
        description={t('account.devices.addDescription')}
      >
        <PairingLinkButton kind="device" label={t('account.devices.add')} />
      </SettingsRow>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={t('account.devices.removeTitle', { name: removing?.name ?? '' })}
        description={t('account.devices.removeDescription')}
        confirmLabel={t('account.devices.remove')}
        cancelLabel={t('account.cancel')}
        onConfirm={() => {
          if (removing) void remove(removing);
        }}
      />
    </SettingsSection>
  );
}
