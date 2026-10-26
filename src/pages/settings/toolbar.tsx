import { useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { EditorToolbarSection } from '@/components/settings/EditorToolbarSection.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

export default function ToolbarSettingsPage() {
  const { group } = useSearch({ from: '/settings/toolbar' });
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  // Opening pushes, so the platform and app-bar Back close the group. Closing pops what opening
  // pushed, or on a cold entry clears the param in place, as `useOpenNote` does for a Note.
  const onOpenFamilyChange = (id: string | null) => {
    if (id) void navigate({ to: '/settings/toolbar', search: { group: id } });
    else if (canGoBack) router.history.back();
    else void navigate({ to: '/settings/toolbar', search: {}, replace: true });
  };

  return (
    <SettingsFrame titleKey="settings.pages.toolbar">
      <EditorToolbarSection openFamilyId={group ?? null} onOpenFamilyChange={onOpenFamilyChange} />
    </SettingsFrame>
  );
}
