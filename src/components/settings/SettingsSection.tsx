import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import {
  type PreferenceKey,
  type Preferences,
  usePreferences,
} from '@/context/PreferencesProvider.tsx';
import { cn } from '@/lib/utils.ts';

/** Sections are the page's only structure: new controls join one rather than invent a layout. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-medium text-muted-foreground text-sm">{title}</h2>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  /** For rows whose consequence needs saying. */
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {/* Capped so a long description cannot push the control under it on a wide row. */}
      <span className={cn('flex flex-col', children != null && 'max-w-[65%]')}>
        <span className="text-sm">{label}</span>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </span>
      {children}
    </div>
  );
}

/**
 * Radix's ToggleGroup clears its value when the active item is pressed again, and a
 * setting must never become empty, so the guard lives here once.
 */
export function SegmentedSetting<T extends string>({
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

/** The Preference keys whose value is a `T`: a switch binds a boolean, a segmented row a string. */
type PreferenceOf<T> = {
  [K in PreferenceKey]: Preferences[K] extends T ? K : never;
}[PreferenceKey];

/**
 * A switch bound to a boolean Preference. `keys` is the i18n base: `<keys>.label` and
 * `<keys>.description`. `touch-reach`, not `touch-target`: a switch keeps its own shape (the 44px
 * Touch Rule).
 */
export function PreferenceSwitch({ pref, keys }: { pref: PreferenceOf<boolean>; keys: string }) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const label = t(`${keys}.label`);

  return (
    <SettingsRow label={label} description={t(`${keys}.description`)}>
      <Switch
        className="touch-reach"
        checked={preferences[pref]}
        onCheckedChange={(next) => void setPreference(pref, next)}
        aria-label={label}
      />
    </SettingsRow>
  );
}

/** A segmented row bound to a Preference with a fixed set of values; each option is `<keys>.<value>`. */
export function PreferenceSegmented<K extends PreferenceOf<string>>({
  pref,
  options,
  keys,
}: {
  pref: K;
  options: readonly Preferences[K][];
  keys: string;
}) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SegmentedSetting
      label={t(`${keys}.label`)}
      description={t(`${keys}.description`)}
      value={preferences[pref]}
      options={options.map((option) => ({ value: option, label: t(`${keys}.${option}`) }))}
      onChange={(next) => void setPreference(pref, next)}
    />
  );
}
