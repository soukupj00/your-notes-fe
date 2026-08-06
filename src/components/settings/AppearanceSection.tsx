import { useTranslation } from 'react-i18next';
import { type Preferences, usePreferences } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { SegmentedSetting, SettingsSection, SwitchSetting } from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];
const DENSITIES: Preferences['density'][] = ['comfortable', 'compact'];
const REDUCED_MOTION: Preferences['reducedMotion'][] = ['system', 'always', 'never'];

/** Theme and palette: the settings about how the app looks rather than what it does. */
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
 * Density is one control carrying both rhythm and type size, as DESIGN.md
 * specifies compact: tightening the gaps while leaving the type alone would
 * give a denser wall of cards that are each still the same size, which is not
 * what asking for more wall at once means. The values themselves live in
 * `globals.css` behind `:root[data-density="compact"]`.
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
 * Three states rather than a switch, because the honest default is neither on
 * nor off: a user who has already asked their OS for reduced motion should not
 * have to ask this app separately, and a user whose OS asks for it system-wide
 * should still be able to allow motion here. `system` is what the other two
 * override.
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
