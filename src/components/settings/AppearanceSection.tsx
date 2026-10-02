import { useTranslation } from 'react-i18next';
import { type Preferences, usePreferences } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { SegmentedSetting, SettingsSection, SwitchSetting } from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];
const DENSITIES: Preferences['density'][] = ['comfortable', 'compact'];
const REDUCED_MOTION: Preferences['reducedMotion'][] = ['system', 'always', 'never'];

export function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.title')}>
      <ThemeSetting />
      <DensitySetting />
      <ColorBlindSetting />
      <ReducedMotionSetting />
      <SinkCheckedItemsSetting />
    </SettingsSection>
  );
}

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

/**
 * One control carries both rhythm and type size, as DESIGN.md specifies compact. The
 * values live in `globals.css` under `:root[data-density="compact"]`.
 */
function DensitySetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SegmentedSetting
      label={t('settings.density.label')}
      description={t('settings.density.description')}
      value={preferences.density}
      options={DENSITIES.map((option) => ({
        value: option,
        label: t(`settings.density.${option}`),
      }))}
      onChange={(next) => void setPreference('density', next)}
    />
  );
}

/**
 * Three states, not a switch: `system` follows the OS, and either explicit choice
 * overrides it in both directions.
 */
function ReducedMotionSetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SegmentedSetting
      label={t('settings.reducedMotion.label')}
      description={t('settings.reducedMotion.description')}
      value={preferences.reducedMotion}
      options={REDUCED_MOTION.map((option) => ({
        value: option,
        label: t(`settings.reducedMotion.${option}`),
      }))}
      onChange={(next) => void setPreference('reducedMotion', next)}
    />
  );
}

function ColorBlindSetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SwitchSetting
      label={t('settings.colorBlind.label')}
      description={t('settings.colorBlind.description')}
      checked={preferences.colorBlind}
      onChange={(next) => void setPreference('colorBlind', next)}
    />
  );
}

function SinkCheckedItemsSetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SwitchSetting
      label={t('settings.sinkCheckedItems.label')}
      description={t('settings.sinkCheckedItems.description')}
      checked={preferences.sinkCheckedItems}
      onChange={(next) => void setPreference('sinkCheckedItems', next)}
    />
  );
}

export default AppearanceSection;
