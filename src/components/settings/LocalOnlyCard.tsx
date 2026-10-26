import { BookOpen, Download, ExternalLink, LogIn, Server, Smartphone } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SignInDialog } from '@/components/account/SignInDialog.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { exportBackup } from '@/lib/export-backup.ts';
import type { ServerState } from './useServerState.ts';

const ACTION_ROW =
  'flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

function NewTabRow({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ACTION_ROW}>
      {icon}
      <span className="flex-1">{children}</span>
      <ExternalLink aria-hidden className="size-4!" />
      <span className="sr-only"> {t('nav.newTab')}</span>
    </a>
  );
}

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
    <section className="mb-4 divide-y rounded-card border bg-card *:last:rounded-b-card">
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
        <>
          <button
            type="button"
            className={ACTION_ROW}
            disabled={exporting.busy}
            onClick={() =>
              void exporting.run(async () => (await exportBackup(store)) === 'saved', {
                success: 'settings.backup.exported',
                failure: 'settings.backup.error.unknown',
              })
            }
          >
            <Download aria-hidden />
            <span className="flex-1">{t('settings.home.local.backUp')}</span>
          </button>
          <NewTabRow href={setupUrl} icon={<Server aria-hidden />}>
            {t('settings.home.local.syncWithServer')}
          </NewTabRow>
        </>
      )}

      {state === 'setup-needed' && (
        <NewTabRow href={setupUrl} icon={<BookOpen aria-hidden />}>
          {t('settings.home.local.setupGuide')}
        </NewTabRow>
      )}

      {state === 'signed-out' && (
        <>
          <button type="button" className={ACTION_ROW} onClick={() => setSigningIn(true)}>
            <LogIn aria-hidden />
            <span className="flex-1">{t('account.section.signIn')}</span>
          </button>
          <SignInDialog open={signingIn} onOpenChange={setSigningIn} />
        </>
      )}
    </section>
  );
}
