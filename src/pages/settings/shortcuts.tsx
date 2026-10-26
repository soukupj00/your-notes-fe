import { Navigate } from '@tanstack/react-router';
import { ShortcutsSection } from '@/components/settings/ShortcutsSection.tsx';
import { useKeyboardAffordances } from '@/hooks/useKeyboardAffordances.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function ShortcutsSettingsPage() {
  const keyboard = useKeyboardAffordances();

  // The Home lists no row without a keyboard (ADR 0028), but a link can still land here.
  if (!keyboard) return <Navigate to="/settings" replace />;

  return (
    <SettingsFrame titleKey="settings.pages.shortcuts">
      <ShortcutsSection />
    </SettingsFrame>
  );
}
