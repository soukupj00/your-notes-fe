import { useTranslation } from 'react-i18next';
import { DENSITY_OPTIONS, REDUCED_MOTION_OPTIONS } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import {
  PreferenceSegmented,
  PreferenceSwitch,
  SegmentedSetting,
  SettingsSection,
} from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];

export function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.title')}>
      <ThemeSetting />
      {/* One control carries both rhythm and type size, as DESIGN.md specifies compact; the
          values live in `globals.css` under `:root[data-density="compact"]`. */}
      <PreferenceSegmented pref="density" options={DENSITY_OPTIONS} keys="settings.density" />
      <PreferenceSwitch pref="colorBlind" keys="settings.colorBlind" />
      {/* Three states, not a switch: `system` follows the OS, and either explicit choice
          overrides it in both directions. */}
      <PreferenceSegmented
        pref="reducedMotion"
        options={REDUCED_MOTION_OPTIONS}
        keys="settings.reducedMotion"
      />
      <PreferenceSwitch pref="sinkCheckedItems" keys="settings.sinkCheckedItems" />
    </SettingsSection>
  );
}

/** Not a Preference: `ThemeProvider` keeps the theme under its own storage key (CLAUDE.md, Theming). */
function ThemeSetting() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedSetting
      label={t('settings.theme.label')}
      value={theme}
      options={THEMES.map((option) => ({ value: option, label: t(`settings.theme.${option}`) }))}
      onChange={setTheme}
    />
  );
}

export default AppearanceSection;
