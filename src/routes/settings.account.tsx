import { createFileRoute } from '@tanstack/react-router';
import AccountSettingsPage from '@/pages/settings/account.tsx';

export const Route = createFileRoute('/settings/account')({ component: AccountSettingsPage });
