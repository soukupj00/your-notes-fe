import { EditorToolbarSection } from '@/components/settings/EditorToolbarSection.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function ToolbarSettingsPage() {
  return (
    <SettingsSubpage titleKey="settings.pages.toolbar">
      <EditorToolbarSection />
    </SettingsSubpage>
  );
}
