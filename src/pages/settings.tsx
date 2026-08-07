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
      {/* Visually the topbar's job on mobile, this heading's job on desktop -
          where the bar carries no title, because the rail already does. It stays
          in the DOM either way: it is the route's focus target
          (`useFocusOnMount`) and the document outline, neither of which a span
          in the bar could take over without moving focus above `#main-content`
          and stranding the skip link past it. */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="sr-only sm:not-sr-only sm:mb-6 sm:font-semibold sm:text-2xl sm:focus-visible:outline-none"
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
