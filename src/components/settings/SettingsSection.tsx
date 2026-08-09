import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';

/**
 * One titled group of settings. Sections are the page's only structure - each
 * later slice drops its controls into an existing section (or adds one) rather
 * than inventing its own layout.
 */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-medium text-muted-foreground text-sm">{title}</h2>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  );
}

/** A labelled row inside a section: what it does on the left, the control on the right. */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  /** Optional second line under the label, for rows whose consequence needs saying. */
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
 * A settings row whose control is a segmented picker over a closed set.
 *
 * Shared for one reason worth naming: Radix's ToggleGroup clears its value when
 * the *active* item is pressed again, which for a setting means a tap on
 * "Compact" while compact turns the app into no density at all. Every segmented
 * setting needs the same guard, so it lives here rather than being remembered
 * at each call site.
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

/**
 * A settings row whose control is one on/off switch.
 *
 * `touch-reach` rather than `touch-target`: a switch's shape is part of what it
 * says, so it keeps its own size and gets its 44px hit box invisibly (DESIGN.md
 * → The 44px Touch Rule).
 */
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
