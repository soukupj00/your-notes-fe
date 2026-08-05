import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { type Preferences, usePreferences } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

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

/**
 * A settings row whose control is a segmented picker over a closed set.
 *
 * Shared by all three of them for one reason worth naming: Radix's ToggleGroup
 * clears its value when the *active* item is pressed again, which for a
 * setting means a tap on "Compact" while compact turns the app into no density
 * at all. Every one of these needs the same guard, so it lives in one place
 * rather than being remembered three times.
 */
function SegmentedSetting<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => onChange((next as T) || value)}
        variant="outline"
        size="sm"
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsRow>
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
    <SettingsRow
      label={t('settings.colorBlind.label')}
      description={t('settings.colorBlind.description')}
    >
      <Switch
        className="touch-reach"
        checked={preferences.colorBlind}
        onCheckedChange={(next) => setPreference('colorBlind', next)}
        aria-label={t('settings.colorBlind.label')}
      />
    </SettingsRow>
  );
}

function SinkCheckedItemsSetting() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsRow
      label={t('settings.sinkCheckedItems.label')}
      description={t('settings.sinkCheckedItems.description')}
    >
      <Switch
        className="touch-reach"
        checked={preferences.sinkCheckedItems}
        onCheckedChange={(next) => setPreference('sinkCheckedItems', next)}
        aria-label={t('settings.sinkCheckedItems.label')}
      />
    </SettingsRow>
  );
}

export default AppearanceSection;
