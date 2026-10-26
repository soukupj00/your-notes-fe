import { QuickCaptureSection } from '@/components/settings/QuickCaptureSection.tsx';
import { SettingsSubpage } from './SettingsSubpage.tsx';

export default function QuickCaptureSettingsPage() {
  return (
    <SettingsSubpage titleKey="settings.pages.quickCapture">
      <QuickCaptureSection />
    </SettingsSubpage>
  );
}
