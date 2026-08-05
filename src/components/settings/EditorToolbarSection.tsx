import { useTranslation } from 'react-i18next';
import { ToolbarLayoutEditor } from '@/components/editor/toolbar/ToolbarLayoutEditor.tsx';
import { SettingsSection } from './SettingsSection.tsx';

/**
 * The Layout editor's home in Settings, with the preview strip on - this screen
 * has no note open, so the strip is the only picture of the resulting bar. The
 * same editor is mounted without it in the sheet over the note dialog, where the
 * real bar is a few pixels away and updating live.
 */
export function EditorToolbarSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.toolbar.title')}>
      <p className="px-4 py-3 text-muted-foreground text-sm">{t('settings.toolbar.description')}</p>
      <ToolbarLayoutEditor showPreview />
    </SettingsSection>
  );
}

export default EditorToolbarSection;
