import { ToolbarLayoutEditor } from '@/components/editor/toolbar/ToolbarLayoutEditor.tsx';
import { SettingsSection } from './SettingsSection.tsx';

/** Untitled: its page is named Editor toolbar. */
export function EditorToolbarSection() {
  return (
    <SettingsSection>
      <ToolbarLayoutEditor showPreview />
    </SettingsSection>
  );
}

export default EditorToolbarSection;
