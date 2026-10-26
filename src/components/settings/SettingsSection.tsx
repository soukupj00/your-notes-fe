import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import {
  type PreferenceKey,
  type Preferences,
  usePreferences,
} from '@/context/PreferencesProvider.tsx';

/** Sections are the page's only structure: new controls join one rather than invent a layout. */
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      {title && <h2 className="mb-2 font-medium text-muted-foreground text-sm">{title}</h2>}
      {/* Not clipped: a dragged row must be able to leave the card. */}
      <div className="divide-y rounded-card border bg-card *:first:rounded-t-card *:last:rounded-b-card">
        {children}
      </div>
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
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    // A control dropped under its label read as the next row's.
    <div className="flex items-center justify-between gap-3 px-4 py-3 *:last:shrink-0">
      <span className="flex min-w-0 flex-1 flex-col">
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
        aria-label={label}
        className="gap-0.5 rounded-control border border-(--rule-control) p-0.5"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="min-h-9.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-muted-foreground data-[state=on]:bg-selected data-[state=on]:text-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsRow>
  );
}

/** The Preference keys whose value is a `T`, so a switch binds only a boolean one. */
type PreferenceOf<T> = {
  [K in PreferenceKey]: Preferences[K] extends T ? K : never;
}[PreferenceKey];

/**
 * A switch bound to a boolean Preference. `keys` is the i18n base: `<keys>.label` and, unless
 * `describe` is off, `<keys>.description`. `touch-reach`, not `touch-target`: a switch keeps its
 * own shape (the 44px Touch Rule).
 */
export function PreferenceSwitch({
  pref,
  keys,
  describe = true,
}: {
  pref: PreferenceOf<boolean>;
  keys: string;
  describe?: boolean;
}) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const label = t(`${keys}.label`);

  return (
    <SettingsRow label={label} description={describe ? t(`${keys}.description`) : undefined}>
      <Switch
        className="touch-reach"
        checked={preferences[pref]}
        onCheckedChange={(next) => void setPreference(pref, next)}
        aria-label={label}
      />
    </SettingsRow>
  );
}
