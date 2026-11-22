import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { useSaveBackup } from '@/hooks/data/useBackup.ts';
import { useEraseDevice } from '@/hooks/data/useEraseDevice.ts';
import { useAction } from '@/hooks/useAction.ts';

/**
 * Signing out erases this Device (04-sync.md "Account boundary"), so it is refused while
 * anything owed to the server exists only here; the refusal offers sync or a Backup.
 */
export function SignOutButton() {
  const { t } = useTranslation();
  const eraseDevice = useEraseDevice();
  const { service, setSession } = useAccount();
  const sync = useSync();
  const [dialog, setDialog] = useState<'blocked' | 'confirm' | null>(null);
  const erasing = useAction();
  const backup = useSaveBackup();
  // One lock for both: clearing the store while a Backup still reads it would save a partial file.
  const busy = erasing.busy || backup.busy;

  const erase = async () => {
    if (!service) return;
    await erasing.run(
      async () => {
        // Asked again at the last moment: an edit may have landed since the dialog opened.
        if (await sync.owes()) {
          setDialog('blocked');
          return false;
        }
        await service.signOut();
        await sync.stop();
        await eraseDevice();
        setSession(null);
      },
      { success: 'account.section.signedOut' }
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={busy}
        onClick={() => setDialog(sync.pending > 0 ? 'blocked' : 'confirm')}
      >
        {t('account.section.signOut')}
      </Button>

      <ConfirmDialog
        open={dialog === 'confirm'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('account.section.eraseTitle')}
        description={t('account.section.eraseDescription')}
        confirmLabel={t('account.section.eraseConfirm')}
        cancelLabel={t('account.cancel')}
        onConfirm={() => void erase()}
      />

      <Dialog
        open={dialog === 'blocked'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('account.section.blockedTitle')}</DialogTitle>
            <DialogDescription>
              {t('account.section.blockedDescription', { count: sync.pending })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t('account.section.close')}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void backup.save()}>
              {t('account.section.saveBackup')}
            </Button>
            <Button
              onClick={() => {
                setDialog(null);
                void sync.syncNow();
              }}
            >
              {t('sync.syncNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
