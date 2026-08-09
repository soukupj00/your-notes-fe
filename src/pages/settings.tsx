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

      {/* The Tour's two Settings targets are declared here rather than inside a
          section, so no section has to know the Tour exists and both anchors are
          legible in one place. They wrap rather than mark, because each step
          points at a *block* of related rows and a bare `div` changes no layout.

          Step 4 stops at what is inside this block. Density, the colour-blind
          palette and motion live in `AppearanceSection` two sections up, and
          reaching them would mean dragging `LabelsSection` into the cutout as
          well; the step's copy was narrowed instead of the page reordered. */}
      <div data-tour="settings-customisation">
        <EditorToolbarSection />

        <QuickCaptureSection />
      </div>

      <ShortcutsSection />

      {/* `PwaInstallSection` renders nothing unless the browser is offering an
          install, so it cannot be step 5's anchor on its own - and step 5 is the
          one carrying the fact that the data is local, which may not be the step
          that goes missing. `BackupSection` always renders and holds the
          actionable half of the same message. */}
      <div data-tour="settings-local">
        <PwaInstallSection />

        <BackupSection />
      </div>
    </div>
  );
}
