import { Database, Keyboard, Plus, RefreshCw, SlidersHorizontal, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HelpSection } from '@/components/settings/HelpSection.tsx';
import { HomeAccountCard } from '@/components/settings/HomeAccountCard.tsx';
import { LocalOnlyCard } from '@/components/settings/LocalOnlyCard.tsx';
import { PwaInstallSection } from '@/components/settings/PwaInstallSection.tsx';
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow.tsx';
import { SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { useServerState } from '@/components/settings/useServerState.ts';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useKeyboardAffordances } from '@/hooks/useKeyboardAffordances.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

/** The data row is named for the account: `settings.pages.<row>` and `settings.home.<row>.summary`. */
export const DATA_ROW = { synced: 'dataSync', local: 'dataLocal' } as const;

export default function SettingsHomePage() {
  const { t } = useTranslation();
  const { session } = useAccount();
  const server = useServerState();
  const keyboard = useKeyboardAffordances();
  const data = session ? DATA_ROW.synced : DATA_ROW.local;

  return (
    <SettingsFrame titleKey="nav.settings" home settled={server !== 'checking'}>
      {/* Neither card while the server has not answered, so the wrong one never flashes. */}
      {session && <HomeAccountCard session={session} />}
      {(server === 'none' || server === 'setup-needed' || server === 'signed-out') && (
        <LocalOnlyCard state={server} />
      )}

      <SettingsSection>
        <SettingsLinkRow
          to="/settings/general"
          icon={<SlidersHorizontal />}
          label={t('settings.pages.general')}
          summary={t('settings.home.general.summary')}
        />
        <SettingsLinkRow
          to="/settings/toolbar"
          icon={<Type />}
          label={t('settings.pages.toolbar')}
          summary={t('settings.home.toolbar.summary')}
          tourTarget="settings-toolbar-row"
        />
        <SettingsLinkRow
          to="/settings/quick-capture"
          icon={<Plus />}
          label={t('settings.pages.quickCapture')}
          summary={
            <>
              <span className="sm:hidden">{t('settings.home.quickCapture.summary')}</span>
              <span className="hidden sm:inline">
                {t('settings.home.quickCapture.summaryWide')}
              </span>
            </>
          }
          tourTarget="settings-quick-capture-row"
        />
        <SettingsLinkRow
          to="/settings/data"
          icon={session ? <RefreshCw /> : <Database />}
          label={t(`settings.pages.${data}`)}
          summary={t(`settings.home.${data}.summary`)}
          tourTarget="settings-data-row"
        />
        {/* Only once there is a keyboard to press them on (ADR 0028). */}
        {keyboard && (
          <SettingsLinkRow
            to="/settings/shortcuts"
            icon={<Keyboard />}
            label={t('settings.pages.shortcuts')}
          />
        )}
      </SettingsSection>

      <HelpSection />

      <PwaInstallSection />
    </SettingsFrame>
  );
}
