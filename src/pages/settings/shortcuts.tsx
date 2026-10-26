import { Navigate } from '@tanstack/react-router';
import { ShortcutsSection } from '@/components/settings/ShortcutsSection.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function ShortcutsSettingsPage() {
  const finePointer = useFinePointer();

  // A phone has no modifier keys; the Home lists no row for it there, but a link or a resize can.
  if (!finePointer) return <Navigate to="/settings" replace />;

  return (
    <SettingsFrame titleKey="settings.pages.shortcuts">
      <ShortcutsSection />
    </SettingsFrame>
  );
}
