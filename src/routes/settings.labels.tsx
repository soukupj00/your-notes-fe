import { createFileRoute } from '@tanstack/react-router';
import LabelsPage from '@/pages/labels.tsx';

export const Route = createFileRoute('/settings/labels')({ component: LabelsPage });
