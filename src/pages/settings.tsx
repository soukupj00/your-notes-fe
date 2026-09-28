import { useTranslation } from 'react-i18next';
import { AccountSection } from '@/components/settings/AccountSection.tsx';
import { AppearanceSection } from '@/components/settings/AppearanceSection.tsx';
import { BackupSection } from '@/components/settings/BackupSection.tsx';
import { DevicesSection } from '@/components/settings/DevicesSection.tsx';
import { EditorToolbarSection } from '@/components/settings/EditorToolbarSection.tsx';
import { HelpSection } from '@/components/settings/HelpSection.tsx';
import { LanguageSection } from '@/components/settings/LanguageSection.tsx';
import { MembersSection } from '@/components/settings/MembersSection.tsx';
import { PwaInstallSection } from '@/components/settings/PwaInstallSection.tsx';
import { QuickCaptureSection } from '@/components/settings/QuickCaptureSection.tsx';
import { SharesSection } from '@/components/settings/SharesSection.tsx';
import { ShortcutsSection } from '@/components/settings/ShortcutsSection.tsx';
import { SyncStatusSection } from '@/components/settings/SyncStatusSection.tsx';
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

      {/* The Tour's Settings targets are declared here rather than inside a
          section, so no section has to know the Tour exists and the anchors are
          legible in one place. They wrap rather than mark, because a step points
          at a *block* of related rows and a bare `div` changes no layout.

          These two used to be one `settings-customisation` block covering both
          sections, and it could not work: the pair measures 1296px on an 839px
          phone, the app is `inert` for the Tour's lifetime so the user cannot
          scroll to the rest, and `EditorToolbarSection` alone is still 880px.
          Two steps pointing at two things that fit beats one step pointing at a
          hole whose bottom edge is off-screen. The toolbar step aims at the
          preview strip inside the section (`settings-toolbar`, marked by
          `ToolbarPreviewStrip` itself) rather than at this wrapper. */}
      <EditorToolbarSection />

      <div data-tour="settings-quick-capture">
        <QuickCaptureSection />
      </div>

      <ShortcutsSection />

      {/* Deliberately between the shortcuts and the closing pair: it is the
          other "learn the app" surface, and putting it here keeps
          `PwaInstallSection` + `BackupSection` adjacent for the Tour's own last
          step to point at. */}
      <HelpSection />

      {/* `PwaInstallSection` renders nothing unless the browser is offering an
          install, so it cannot be step 5's anchor on its own - and step 5 is the
          one carrying the fact that the data is local, which may not be the step
          that goes missing. `BackupSection` always renders and holds the
          actionable half of the same message. */}
      <div data-tour="settings-local">
        <PwaInstallSection />

        <BackupSection />
      </div>

      {/* Where the data goes beyond this Device, beside where it lives on it.
          Outside the Tour's `settings-local` block on purpose: these render only
          when a Self-hosted Server answered, and a step's anchor must not change
          size with the server. Each renders nothing when it does not apply. */}
      <SyncStatusSection />

      <AccountSection />

      <DevicesSection />

      <SharesSection />

      <MembersSection />
    </div>
  );
}
