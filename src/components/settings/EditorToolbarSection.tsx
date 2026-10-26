import { ToolbarLayoutEditor } from '@/components/editor/toolbar/ToolbarLayoutEditor.tsx';
import { SettingsSection } from './SettingsSection.tsx';

/** Each part of the editor is a section of its own page, as on every other Settings page. */
export function EditorToolbarSection() {
  return <ToolbarLayoutEditor showPreview Section={SettingsSection} />;
}

export default EditorToolbarSection;
