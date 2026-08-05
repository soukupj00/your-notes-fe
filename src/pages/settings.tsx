import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BackupSection } from '@/components/settings/BackupSection.tsx';
import { PwaInstallSection } from '@/components/settings/PwaInstallSection.tsx';
import { QuickCaptureSection } from '@/components/settings/QuickCaptureSection.tsx';
import { SettingsRow, SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

const THEMES: Theme[] = ['system', 'light', 'dark'];

function ThemeSetting() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SettingsRow label={t('settings.theme.label')}>
      <ToggleGroup
        type="single"
        value={theme}
        // Radix clears the value when the active item is pressed again; keeping
        // the current theme makes the group behave like a radio group.
        onValueChange={(next) => setTheme((next as Theme) || theme)}
        variant="outline"
        size="sm"
        aria-label={t('settings.theme.label')}
      >
        {THEMES.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {t(`settings.theme.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsRow>
  );
}

function ColorBlindSetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsRow
      label={t('settings.colorBlind.label')}
      description={t('settings.colorBlind.description')}
    >
      <Switch
        className="touch-target"
        checked={preferences.colorBlind}
        onCheckedChange={(next) => setPreference('colorBlind', next)}
        aria-label={t('settings.colorBlind.label')}
      />
    </SettingsRow>
  );
}

/**
 * Settings shell. Appearance and Labels are wired; the remaining controls
 * (toolbar, density/reduced-motion, language, backup) land with the tasks that
 * own them and slot into sections here.
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 font-semibold text-2xl focus-visible:outline-none"
      >
        {t('nav.settings')}
      </h1>

      <SettingsSection title={t('settings.appearance.title')}>
        <ThemeSetting />
        <ColorBlindSetting />
      </SettingsSection>

      <SettingsSection title={t('nav.labels')}>
        <SettingsRow label={t('settings.labels.description')}>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/labels">{t('nav.editLabels')}</Link>
          </Button>
        </SettingsRow>
      </SettingsSection>

      <QuickCaptureSection />

      <PwaInstallSection />

      <BackupSection />
    </div>
  );
}
