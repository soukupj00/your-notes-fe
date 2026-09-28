import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { backupFilename, buildBackupZip, requestSaveTarget } from '@/lib/backup.ts';

/**
 * Sign out, which erases this Device (04-sync.md "Account boundary"): the server
 * holds everything, and the next person on a shared laptop must not adopt this
 * one's Notes. So it is refused while anything is still owed to the server -
 * that would be the one copy of it - and the refusal offers the ways out: sync
 * now, or save a Backup first.
 */
export function SignOutButton() {
  const { t } = useTranslation();
  const store = useLocalStore();
  const { service, setSession } = useAccount();
  const sync = useSync();
  const [dialog, setDialog] = useState<'blocked' | 'confirm' | null>(null);
  const [busy, setBusy] = useState(false);

  const erase = async () => {
    if (!service) return;
    setBusy(true);
    try {
      // Asked again at the last moment: an edit may have landed since the dialog opened.
      const owed = await store.sync.dirty();
      if (Object.values(owed).some((rows) => rows.length > 0)) {
        setDialog('blocked');
        return;
      }
      await service.signOut();
      await sync.stop();
      await store.clear();
      setSession(null);
      toast.success(t('account.section.signedOut'));
    } catch {
      toast.error(t('account.errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const saveBackup = async () => {
    const target = await requestSaveTarget(backupFilename());
    if (!target) return;
    try {
      await target.write(await buildBackupZip(store));
      if (target.confirmed) toast.success(t('settings.backup.exported'));
    } catch {
      toast.error(t('settings.backup.error.unknown'));
    }
  };

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
            <Button variant="outline" onClick={() => void saveBackup()}>
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
