import { createFileRoute } from '@tanstack/react-router';
import ToolbarSettingsPage from '@/pages/settings/toolbar.tsx';

export const Route = createFileRoute('/settings/toolbar')({
  validateSearch: (search: Record<string, unknown>): { group?: string } => ({
    group: typeof search.group === 'string' ? search.group : undefined,
  }),
  component: ToolbarSettingsPage,
});
