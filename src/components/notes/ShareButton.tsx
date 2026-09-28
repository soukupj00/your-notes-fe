import { Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
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
import { shareLink } from '@/contract/index.ts';
import { ProblemError } from '@/data/http/hal.ts';
import type { Share } from '@/data/Remote.ts';
import { cn } from '@/lib/utils.ts';

/**
 * The note bar's Share Link control (CONTEXT.md "Share Link"). Present only
 * while signed in, because the link is the server's, and never on a trashed
 * Note, which the server would not show. A Note already shared carries the
 * pin's pressed mark, so its owner can see an open link before tapping.
 */
export function ShareButton({
  noteId,
  ensureNoteId,
  className,
}: {
  noteId: string | null;
  ensureNoteId: () => Promise<string>;
  className: string;
}) {
  const { t } = useTranslation();
  const { status, service } = useAccount();
  const { syncNow } = useSync();
  const [share, setShare] = useState<Share | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = status === 'signed-in' && service !== null;

  useEffect(() => {
    if (!signedIn || !noteId) return;
    let current = true;
    service
      .shares()
      .then((all) => current && setShare(all.find((s) => s.noteId === noteId) ?? null))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [signedIn, service, noteId]);

  if (!signedIn) return null;

  const mint = async () => {
    setBusy(true);
    try {
      const id = await ensureNoteId();
      let minted: Share;
      try {
        minted = await service.share(id);
      } catch (error) {
        // A Note the server has not seen yet (a fresh draft, or edits still queued).
        if (!(error instanceof ProblemError && error.status === 404)) throw error;
        await syncNow();
        minted = await service.share(id);
      }
      setShare(minted);
      setOpen(true);
    } catch (error) {
      const unsynced = error instanceof ProblemError && error.status === 404;
      toast.error(t(unsynced ? 'share.notSynced' : 'account.errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!share) return;
    try {
      await service.revokeShare(share.id);
      setShare(null);
      setOpen(false);
      toast.success(t('share.stopped'));
    } catch {
      toast.error(t('account.errors.unknown'));
    }
  };

  const link = share ? shareLink(window.location.origin, share.token) : '';
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success(t('account.qr.copied'));
  };

  return (
    <>
      <button
        type="button"
        aria-label={t(share ? 'share.shared' : 'share.action')}
        aria-haspopup="dialog"
        disabled={busy}
        onClick={() => void mint()}
        className={cn(
          className,
          // The pin's pressed mark: an open link is chrome, so it takes the accent.
          share &&
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
        )}
      >
        <Share2 className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('share.title')}</DialogTitle>
            <DialogDescription>{t('share.description')}</DialogDescription>
          </DialogHeader>
          <code className="select-all break-all rounded-md border bg-muted px-2 py-1 text-xs">
            {link}
          </code>
          <DialogFooter>
            <Button variant="outline" onClick={() => void stop()}>
              {t('share.stop')}
            </Button>
            <Button variant="outline" onClick={() => void copy()}>
              {t('account.qr.copy')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('account.qr.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
