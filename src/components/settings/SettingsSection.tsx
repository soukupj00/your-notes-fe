import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';

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
      <span className="flex min-w-0 flex-col">
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

/** `touch-reach`, not `touch-target`: a switch keeps its own shape (the 44px Touch Rule). */
export function SwitchSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
      <Switch
        className="touch-reach"
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </SettingsRow>
  );
}
