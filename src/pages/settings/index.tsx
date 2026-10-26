import { Keyboard, Plus, RefreshCw, SlidersHorizontal, Type, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HelpSection } from '@/components/settings/HelpSection.tsx';
import { PwaInstallSection } from '@/components/settings/PwaInstallSection.tsx';
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow.tsx';
import { SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function SettingsHomePage() {
  const { t } = useTranslation();
  const { status } = useAccount();
  const finePointer = useFinePointer();
  const data = status === 'signed-in' ? 'dataSync' : 'dataLocal';

  return (
    <SettingsSubpage titleKey="nav.settings">
      {status === 'signed-in' && (
        <SettingsSection>
          <SettingsLinkRow
            to="/settings/account"
            icon={<UserRound />}
            label={t('settings.pages.account')}
          />
        </SettingsSection>
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
          summary={t('settings.home.quickCapture.summary')}
          tourTarget="settings-quick-capture-row"
        />
        <SettingsLinkRow
          to="/settings/data"
          icon={<RefreshCw />}
          label={t(`settings.pages.${data}`)}
          summary={t(`settings.home.${data}.summary`)}
          tourTarget="settings-data-row"
        />
        {/* As `ShortcutsSection`: a phone has no modifier keys. */}
        {finePointer && (
          <SettingsLinkRow
            to="/settings/shortcuts"
            icon={<Keyboard />}
            label={t('settings.pages.shortcuts')}
          />
        )}
      </SettingsSection>

      <HelpSection />

      <PwaInstallSection />
    </SettingsSubpage>
  );
}
