import { useTranslation } from 'react-i18next';
import { ToolbarLayoutEditor } from '@/components/editor/toolbar/ToolbarLayoutEditor.tsx';
import { SettingsSection } from './SettingsSection.tsx';

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
