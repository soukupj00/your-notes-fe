import { AppearanceSection } from '@/components/settings/AppearanceSection.tsx';
import { LanguageSection } from '@/components/settings/LanguageSection.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function GeneralSettingsPage() {
  return (
    <SettingsSubpage titleKey="settings.pages.general">
      <LanguageSection />
      <AppearanceSection />
    </SettingsSubpage>
  );
}
