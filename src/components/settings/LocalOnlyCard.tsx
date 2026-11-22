import { BookOpen, Download, LogIn, Server, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SignInDialog } from '@/components/account/SignInDialog.tsx';
import { useSaveBackup } from '@/hooks/data/useSaveBackup.ts';
import { NewTabRow, SETTINGS_ACTION_ROW } from './SettingsActionRow.tsx';
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
  const backup = useSaveBackup();
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
            className={SETTINGS_ACTION_ROW}
            disabled={backup.busy}
            onClick={() => void backup.save()}
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
          <button type="button" className={SETTINGS_ACTION_ROW} onClick={() => setSigningIn(true)}>
            <LogIn aria-hidden />
            <span className="flex-1">{t('account.section.signIn')}</span>
          </button>
          <SignInDialog open={signingIn} onOpenChange={setSigningIn} />
        </>
      )}
    </section>
  );
}
