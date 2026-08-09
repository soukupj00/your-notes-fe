import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * The way into label management. The managing itself is a page of its own
 * (`/settings/labels`) - renaming, colouring and merging need room this list
 * of rows does not have.
 */
export function LabelsSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('nav.labels')}>
      <SettingsRow label={t('settings.labels.description')}>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/labels">{t('nav.editLabels')}</Link>
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}

export default LabelsSection;
