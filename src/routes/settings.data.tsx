import { createFileRoute } from '@tanstack/react-router';
import DataSettingsPage from '@/pages/settings/data.tsx';

export const Route = createFileRoute('/settings/data')({ component: DataSettingsPage });
