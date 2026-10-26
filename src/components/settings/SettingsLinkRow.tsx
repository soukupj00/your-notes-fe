import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type SettingsPath =
  | '/settings/general'
  | '/settings/toolbar'
  | '/settings/quick-capture'
  | '/settings/data'
  | '/settings/account'
  | '/settings/shortcuts';

/** A row that opens a Settings subpage; `tourTarget` is the Tour's anchor (ADR 0024). */
export function SettingsLinkRow({
  to,
  icon,
  label,
  summary,
  tourTarget,
}: {
  to: SettingsPath;
  icon: ReactNode;
  label: string;
  summary?: ReactNode;
  tourTarget?: string;
}) {
  return (
    <Link
      to={to}
      data-tour={tourTarget}
      className="flex min-h-14 items-center gap-3.5 px-4 py-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted [&_svg]:size-4.5"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {summary && <span className="text-muted-foreground text-xs">{summary}</span>}
      </span>
      <ChevronRight aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
