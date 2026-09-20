import { clsx } from 'clsx';
import { Bell, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatReminderTime, isReminderPast, type Reminder } from '@/lib/reminder.ts';

/**
 * A Note's Reminder as the Card shows it: a record, not a control (ADR 0021).
 * It is a `span`, so a tap on it is a tap on the Card and opens the Note -
 * where the bell is.
 *
 * It takes the pill, the 11px type and the exact height of a label chip
 * (DESIGN.md → Chips) and differs by fill and case: outlined and sentence-case,
 * because it records a time rather than naming one of the note's labels.
 *
 * `clsx`, not `cn`: tailwind-merge reads the project's own `text-label` as a
 * text *colour* (it only knows Tailwind's own size scale), so a `cn` carrying
 * both `text-label` and `text-muted-foreground` silently drops the size and the
 * chip renders at the inherited 16px. Measured in the browser, not assumed.
 */
export function ReminderChip({ reminder, now }: { reminder: Reminder; now?: Date }) {
  const { t, i18n } = useTranslation();
  const when = formatReminderTime(reminder.remindAt, i18n.language);
  const past = isReminderPast(reminder, now);
  const repeat = reminder.repeat ? t(`reminders.repeats.${reminder.repeat}`) : undefined;

  return (
    <span
      data-testid="reminder-chip"
      data-past={past}
      // `role="img"`: the chip is one named unit, so its two truncating runs
      // are read as the whole Reminder rather than as fragments of it - and the
      // name carries the untruncated string the pixels may have cut.
      role="img"
      aria-label={
        repeat
          ? t('reminders.chipRepeating', { when, repeat })
          : // A repeating Reminder is never past (`isReminderPast`), so there is
            // no repeating-past variant to write. The strike is pixels only.
            t(past ? 'reminders.chipPast' : 'reminders.chip', { when })
      }
      className={clsx(
        'inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-full border border-border px-2 py-[3px] text-label text-muted-foreground normal-case tracking-normal',
        // Struck through, and nothing else: the chip is already at the 11px
        // label floor and at 4.6:1 on a coloured card by day, so the obvious
        // extra of fading it (the brief's `opacity-60`) measured 2.68:1 light
        // and 3.46:1 dark - under WCAG 1.4.3 for small text, in both themes.
        // The strike says "no longer upcoming" without spending contrast.
        past && 'line-through'
      )}
    >
      <Bell className="size-3 shrink-0" aria-hidden />
      {/* The time gives ground last: it is the record, and the repeat's word is
          a qualifier whose glyph already says the Reminder recurs. A shrink
          *weight* rather than `shrink-0` on the time, because a rigid time on a
          phone-width card does not wrap - it is clipped mid-glyph by the card's
          edge, taking the chip's rounded corner with it. Both truncate; the
          word simply absorbs ~99% of any deficit first, and the whole string is
          in the accessible name either way. */}
      <span className="min-w-0 truncate">{when}</span>
      {repeat && (
        <>
          <Repeat className="size-3 shrink-0" aria-hidden />
          <span className="min-w-0 shrink-[999] truncate">{repeat}</span>
        </>
      )}
    </span>
  );
}
