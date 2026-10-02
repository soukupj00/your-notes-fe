import { clsx } from 'clsx';
import { Bell, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatReminderTime, isReminderPast, type Reminder } from '@/lib/reminder.ts';

/**
 * A record, not a control (ADR 0021): a tap falls through to the Card. Outlined and sentence-case
 * because it records a time rather than naming a label. `clsx`, not `cn`: tailwind-merge reads
 * `text-label` as a colour and silently drops the 11px size next to `text-muted-foreground`.
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
      // One named unit, so its two truncating runs are read as the whole Reminder, untruncated.
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
        // Struck, not faded: fading fails contrast at the label floor (CLAUDE.md, Reminders).
        past && 'line-through'
      )}
    >
      <Bell className="size-3 shrink-0" aria-hidden />
      {/* The repeat word gives ground first. Not `shrink-0` on the time: a rigid time would be
          clipped mid-glyph at phone width, taking the chip's rounded corner with it. */}
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
