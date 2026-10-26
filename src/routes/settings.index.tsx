import { createFileRoute } from '@tanstack/react-router';
import SettingsHomePage from '@/pages/settings/index.tsx';

export const Route = createFileRoute('/settings/')({ component: SettingsHomePage });
