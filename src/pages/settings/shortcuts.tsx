import { ShortcutsSection } from '@/components/settings/ShortcutsSection.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function ShortcutsSettingsPage() {
  return (
    <SettingsSubpage titleKey="settings.pages.shortcuts">
      <ShortcutsSection />
    </SettingsSubpage>
  );
}
