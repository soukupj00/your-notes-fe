import { createFileRoute } from '@tanstack/react-router';
import GeneralSettingsPage from '@/pages/settings/general.tsx';

export const Route = createFileRoute('/settings/general')({ component: GeneralSettingsPage });
