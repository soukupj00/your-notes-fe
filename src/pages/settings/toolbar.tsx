import { EditorToolbarSection } from '@/components/settings/EditorToolbarSection.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function ToolbarSettingsPage() {
  return (
    <SettingsFrame titleKey="settings.pages.toolbar">
      <EditorToolbarSection />
    </SettingsFrame>
  );
}
