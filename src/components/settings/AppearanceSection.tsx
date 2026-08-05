import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];

/** Theme and palette: the two settings about how the app looks rather than what it does. */
export function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.title')}>
      <ThemeSetting />
      <ColorBlindSetting />
    </SettingsSection>
  );
}

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

export default AppearanceSection;
