import { createFileRoute } from '@tanstack/react-router';
import QuickCaptureSettingsPage from '@/pages/settings/quick-capture.tsx';

export const Route = createFileRoute('/settings/quick-capture')({
  component: QuickCaptureSettingsPage,
});
