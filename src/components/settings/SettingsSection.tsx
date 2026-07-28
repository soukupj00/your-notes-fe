import type { ReactNode } from 'react';

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
