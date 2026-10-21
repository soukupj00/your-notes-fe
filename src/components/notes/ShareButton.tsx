import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { LinkDialog } from '@/components/ui/LinkDialog.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { shareLink } from '@/contract/index.ts';
import { ProblemError } from '@/data/http/hal.ts';
import type { Share } from '@/data/Remote.ts';
import { useAction } from '@/hooks/useAction.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import type { NoteDraft } from '@/lib/draft.ts';
import { cn } from '@/lib/utils.ts';

/** The server has not seen this Note yet: a fresh draft, or edits still queued. */
const unsynced = (error: unknown) => error instanceof ProblemError && error.status === 404;

/**
 * Only while signed in, because the link is the server's, and never on a trashed Note, which the
 * server would not show. A shared Note carries the pressed mark, so its owner sees the open link.
 */
export function ShareButton({ draft, className }: { draft: NoteDraft; className: string }) {
  const { t } = useTranslation();
  const { status, service } = useAccount();
  const { syncNow } = useSync();
  const [share, setShare] = useState<Share | null>(null);
  const [open, setOpen] = useState(false);
  // Survives Stop so the closing dialog keeps its link; the trigger reads share alone.
  const [link, setLink] = useState<string | null>(null);
  const { busy, run } = useAction();
  const signedIn = status === 'signed-in' && service !== null;

  // Only a Note with a row can be shared already. `saved` is a plain read: a Draft that earns its
  // row later is shared only from here, and `mint` sets the mark itself.
  useAsyncEffect(
    async (alive) => {
      if (!signedIn || !draft.saved) return;
      // An unanswered read shows as unshared; the next tap tells the truth.
      const all = await service.shares().catch(() => null);
      if (alive() && all) setShare(all.find((s) => s.noteId === draft.id) ?? null);
    },
    [signedIn, service, draft]
  );

  if (!signedIn) return null;

  const mint = () =>
    run(
      async () => {
        const id = await draft.ensureSaved();
        let minted: Share;
        try {
          minted = await service.share(id);
        } catch (error) {
          if (!unsynced(error)) throw error;
          await syncNow();
          minted = await service.share(id);
        }
        setShare(minted);
        setLink(shareLink(window.location.origin, minted.token));
        setOpen(true);
      },
      { failure: (error) => (unsynced(error) ? 'share.notSynced' : 'account.errors.unknown') }
    );

  const stop = async () => {
    if (!share) return;
    await run(
      async () => {
        await service.revokeShare(share.id);
        setShare(null);
        setOpen(false);
      },
      { success: 'share.stopped' }
    );
  };

  return (
    <>
      <IconTooltip label={t(share ? 'share.shared' : 'share.action')}>
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
      </IconTooltip>
      <LinkDialog
        open={open}
        onOpenChange={setOpen}
        title={t('share.title')}
        description={t('share.description')}
        link={link}
        actions={
          <Button variant="outline" disabled={busy} onClick={() => void stop()}>
            {t('share.stop')}
          </Button>
        }
      />
    </>
  );
}
