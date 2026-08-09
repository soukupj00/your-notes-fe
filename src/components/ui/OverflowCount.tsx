import { cn } from '@/lib/utils.ts';

/**
 * The `+N` chip that stands in for what a capped row did not show.
 *
 * One shape, so the user learns it once: it is the same chip whether the row it
 * ends is labels (`TagPills`) or attachments (`CardMedia`). It takes the card's
 * own chip identity rather than a neutral grey, so it reads as the last item in
 * the row instead of as a control dropped into it, and it differs from a real
 * item by fill only - never by a dashed border (DESIGN.md → Chips).
 */
export function OverflowCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-note-chip px-2.5 py-1 text-label text-note-on-chip tabular-nums',
        className
      )}
    >
      +{count}
    </span>
  );
}
