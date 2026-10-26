import { useTranslation } from 'react-i18next';
import { DisplaySection } from '@/components/settings/DisplaySection.tsx';
import { LanguageAndThemeSection } from '@/components/settings/LanguageAndThemeSection.tsx';
import { PreferenceSwitch, SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function GeneralSettingsPage() {
  const { t } = useTranslation();

  return (
    <SettingsFrame titleKey="settings.pages.general">
      <LanguageAndThemeSection />
      <DisplaySection />
      <SettingsSection title={t('settings.general.checklists')}>
        <PreferenceSwitch
          pref="sinkCheckedItems"
          keys="settings.sinkCheckedItems"
          describe={false}
        />
      </SettingsSection>
    </SettingsFrame>
  );
}
