import { createFileRoute } from '@tanstack/react-router';
import SettingsPage from '@/pages/settings.tsx';

export const Route = createFileRoute('/settings/')({ component: SettingsPage });
