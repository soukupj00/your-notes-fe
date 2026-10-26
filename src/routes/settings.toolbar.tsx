import { createFileRoute } from '@tanstack/react-router';
import ToolbarSettingsPage from '@/pages/settings/toolbar.tsx';

export const Route = createFileRoute('/settings/toolbar')({ component: ToolbarSettingsPage });
