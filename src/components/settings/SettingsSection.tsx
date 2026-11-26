import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import {
  type PreferenceKey,
  type Preferences,
  usePreferences,
} from '@/context/PreferencesProvider.tsx';

/**
 * Sections are the page's only structure: new controls join one rather than invent a layout.
 * `bare` is for controls that are their own surface, which a card around them would nest.
 */
export function SettingsSection({
  title,
  bare,
  children,
}: {
  title?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      {title && <h2 className="mb-2 font-medium text-muted-foreground text-sm">{title}</h2>}
      {bare ? (
        children
      ) : (
        // Not clipped, so a dragged row can leave the card; its edge rows round themselves instead,
        // a list's rows too.
        <div className="divide-y rounded-card border bg-card *:first:rounded-t-card *:last:rounded-b-card [&>:first-child_li:first-child>*]:rounded-t-card [&>:last-child_li:last-child>*]:rounded-b-card">
          {children}
        </div>
      )}
    </section>
  );
}

/** The id of the description a row with this `controlId` renders, for `aria-describedby`. */
export const descriptionIdOf = (controlId: string) => `${controlId}-description`;

/** With `controlId`, the label names and clicks that control, and the description is its own. */
export function SettingsRow({
  label,
  description,
  controlId,
  children,
}: {
  label: string;
  /** For rows whose consequence needs saying. */
  description?: ReactNode;
  controlId?: string;
  children: ReactNode;
}) {
  return (
    // A control dropped under its label read as the next row's.
    <div className="flex items-center justify-between gap-3 px-4 py-3 *:last:shrink-0">
      <span className="flex min-w-0 flex-1 flex-col">
        {controlId ? (
          <label htmlFor={controlId} className="text-sm">
            {label}
          </label>
        ) : (
          <span className="text-sm">{label}</span>
        )}
        {description && (
          <span
            id={controlId && descriptionIdOf(controlId)}
            className="text-muted-foreground text-xs"
          >
            {description}
          </span>
        )}
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
            className="min-h-9.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-muted-foreground -outline-offset-2 data-[state=on]:bg-selected data-[state=on]:text-foreground"
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
  const id = useId();

  return (
    <SettingsRow
      label={t(`${keys}.label`)}
      description={describe ? t(`${keys}.description`) : undefined}
      controlId={id}
    >
      <Switch
        id={id}
        className="touch-reach"
        checked={preferences[pref]}
        onCheckedChange={(next) => void setPreference(pref, next)}
        aria-describedby={describe ? descriptionIdOf(id) : undefined}
      />
    </SettingsRow>
  );
}
