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

/** Every section owns its `SettingsSection` wrapper and controls; this page only orders them. */
export default function SettingsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hidden on mobile, where the topbar carries the title, but always in the DOM: it is the
          route's focus target and outline. A title in the bar would move focus above
          `#main-content` and strand the skip link. */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="sr-only sm:not-sr-only sm:mb-6 sm:font-semibold sm:text-2xl sm:focus-visible:outline-none"
      >
        {t('nav.settings')}
      </h1>

      <LanguageSection />

      <AppearanceSection />

      {/* The Tour's Settings anchors wrap sections here, so no section knows the Tour exists.
          Why they are split the way they are: CLAUDE.md, "Onboarding". */}
      <EditorToolbarSection />

      <div data-tour="settings-quick-capture">
        <QuickCaptureSection />
      </div>

      <ShortcutsSection />

      <HelpSection />

      <PwaInstallSection />

      <BackupSection />

      <div data-tour="settings-sync">
        <SyncStatusSection />
      </div>

      <AccountSection />

      <DevicesSection />

      <SharesSection />

      <MembersSection />
    </div>
  );
}
