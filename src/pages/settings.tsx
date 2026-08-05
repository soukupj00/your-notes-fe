import { useTranslation } from 'react-i18next';
import { AppearanceSection } from '@/components/settings/AppearanceSection.tsx';
import { BackupSection } from '@/components/settings/BackupSection.tsx';
import { EditorToolbarSection } from '@/components/settings/EditorToolbarSection.tsx';
import { LabelsSection } from '@/components/settings/LabelsSection.tsx';
import { LanguageSection } from '@/components/settings/LanguageSection.tsx';
import { PwaInstallSection } from '@/components/settings/PwaInstallSection.tsx';
import { QuickCaptureSection } from '@/components/settings/QuickCaptureSection.tsx';
import { ShortcutsSection } from '@/components/settings/ShortcutsSection.tsx';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * Settings shell: a heading and the sections, in order.
 *
 * Every section owns its own `SettingsSection` wrapper and its own controls
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 font-semibold text-2xl focus-visible:outline-none"
      >
        {t('nav.settings')}
      </h1>

      <LanguageSection />

      <AppearanceSection />

      <LabelsSection />

      <EditorToolbarSection />

      <QuickCaptureSection />

      <ShortcutsSection />

      <PwaInstallSection />

      <BackupSection />
    </div>
  );
}
