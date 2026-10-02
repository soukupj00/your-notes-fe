import { clsx } from 'clsx';

/**
 * The one `+N` chip for labels and attachments alike (DESIGN.md → Chips).
 * `clsx`, not `cn`: tailwind-merge reads `text-label` as a colour and drops it.
 */
export function OverflowCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={clsx(
        'rounded-full bg-note-chip px-2.5 py-1 text-label text-note-on-chip tabular-nums',
        className
      )}
    >
      +{count}
    </span>
  );
}
