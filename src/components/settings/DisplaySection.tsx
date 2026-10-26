import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { type Preferences, usePreferences } from '@/context/PreferencesProvider.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { cn } from '@/lib/utils.ts';
import { PickerTiles } from './PickerTiles.tsx';
import { PreferenceSwitch, SettingsRow, SettingsSection } from './SettingsSection.tsx';

export function DisplaySection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.general.display')}>
      <DensityTiles />
      <ReduceAnimationsSwitch />
      <PreferenceSwitch pref="colorBlind" keys="settings.colorBlind" />
    </SettingsSection>
  );
}

/** A few tall bars against many short ones: the wall at each density, not a word for it. */
function DensityPicture({ bars, height }: { bars: number; height: string }) {
  const widths = ['90%', '70%', '80%', '60%', '85%', '50%'];
  return (
    <span
      className={cn(
        'flex h-14 w-full flex-col overflow-hidden rounded-md bg-muted',
        bars > 3 ? 'gap-0.75 p-1.5' : 'gap-1.75 p-2.25'
      )}
    >
      {widths.slice(0, bars).map((width) => (
        <span
          key={width}
          className={cn('block shrink-0 rounded-xs bg-border', height)}
          style={{ width }}
        />
      ))}
    </span>
  );
}

/** One control carries both rhythm and type size, as DESIGN.md specifies compact. */
function DensityTiles() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const label = t('settings.density.label');

  return (
    <div className="flex flex-col gap-2.5 px-4 pt-3 pb-3.5">
      <span className="text-sm">{label}</span>
      <PickerTiles<Preferences['density']>
        label={label}
        value={preferences.density}
        onChange={(next) => void setPreference('density', next)}
        options={[
          {
            value: 'comfortable',
            label: t('settings.density.comfortable'),
            picture: <DensityPicture bars={3} height="h-2" />,
          },
          {
            value: 'compact',
            label: t('settings.density.compact'),
            picture: <DensityPicture bars={6} height="h-1.25" />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Shows what the app does now, so it reads on when the OS already reduces motion. A toggle
 * writes an explicit choice; the stored `system` default keeps following the OS until then.
 */
export function ReduceAnimationsSwitch() {
  const { t } = useTranslation();
  const { setPreference } = usePreferences();
  const reduced = useReducedMotion();
  const label = t('settings.reducedMotion.label');

  return (
    <SettingsRow label={label} description={t('settings.reducedMotion.description')}>
      <Switch
        className="touch-reach"
        checked={reduced}
        onCheckedChange={(next) => void setPreference('reducedMotion', next ? 'always' : 'never')}
        aria-label={label}
      />
    </SettingsRow>
  );
}
