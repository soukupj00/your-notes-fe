import { QuickCaptureSection } from '@/components/settings/QuickCaptureSection.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function QuickCaptureSettingsPage() {
  return (
    <SettingsFrame titleKey="settings.pages.quickCapture">
      <QuickCaptureSection />
    </SettingsFrame>
  );
}
