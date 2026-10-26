import { Download, ExternalLink, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SignInDialog } from '@/components/account/SignInDialog.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { exportBackup } from '@/lib/export-backup.ts';
import type { ServerState } from './useServerState.ts';

/**
 * The Settings home's top card for a Device with no account. Its one action follows what the
 * server answered: nothing (back up, read how to run one), no Owner yet, or an Owner to sign in to.
 */
export function LocalOnlyCard({
  state,
}: {
  state: Extract<ServerState, 'none' | 'setup-needed' | 'signed-out'>;
}) {
  const { t } = useTranslation();
  const store = useLocalStore();
  const exporting = useAction();
  const [signingIn, setSigningIn] = useState(false);
  const setupUrl = t('settings.help.docs.setupUrl');

  return (
    <section className="mb-4 divide-y rounded-card border bg-card">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted"
        >
          <Smartphone className="size-4.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-sm">{t('settings.home.local.title')}</span>
        </span>
      </div>

      {state === 'none' && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <a
            href={setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-reach min-w-0 rounded-control text-primary text-sm underline-offset-2 hover:underline"
          >
            {t('settings.home.local.syncWithServer')}
          </a>
          <Button
            type="button"
            className="min-h-11 shrink-0"
            disabled={exporting.busy}
            onClick={() =>
              void exporting.run(async () => (await exportBackup(store)) === 'saved', {
                success: 'settings.backup.exported',
                failure: 'settings.backup.error.unknown',
              })
            }
          >
            <Download aria-hidden />
            {t('settings.home.local.backUp')}
          </Button>
        </div>
      )}

      {state === 'setup-needed' && (
        <div className="flex justify-end px-4 py-2.5">
          <Button asChild variant="outline" className="min-h-11">
            <a href={setupUrl} target="_blank" rel="noopener noreferrer">
              {t('settings.home.local.setupGuide')}
              <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
      )}

      {state === 'signed-out' && (
        <div className="flex justify-end px-4 py-2.5">
          <Button type="button" className="min-h-11" onClick={() => setSigningIn(true)}>
            {t('account.section.signIn')}
          </Button>
          <SignInDialog open={signingIn} onOpenChange={setSigningIn} />
        </div>
      )}
    </section>
  );
}
