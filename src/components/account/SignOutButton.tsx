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
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { exportBackup } from '@/lib/export-backup.ts';

/**
 * Signing out erases this Device (04-sync.md "Account boundary"), so it is refused while
 * anything owed to the server exists only here; the refusal offers sync or a Backup.
 */
export function SignOutButton() {
  const { t } = useTranslation();
  const store = useLocalStore();
  const { service, setSession } = useAccount();
  const sync = useSync();
  const [dialog, setDialog] = useState<'blocked' | 'confirm' | null>(null);
  const { busy, run } = useAction();

  const erase = async () => {
    if (!service) return;
    await run(
      async () => {
        // Asked again at the last moment: an edit may have landed since the dialog opened.
        const owed = await store.sync.dirty();
        if (Object.values(owed).some((rows) => rows.length > 0)) {
          setDialog('blocked');
          return false;
        }
        await service.signOut();
        await sync.stop();
        await store.clear();
        setSession(null);
      },
      { success: 'account.section.signedOut' }
    );
  };

  const saveBackup = () =>
    run(async () => (await exportBackup(store)) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
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
            <Button variant="outline" disabled={busy} onClick={() => void saveBackup()}>
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
