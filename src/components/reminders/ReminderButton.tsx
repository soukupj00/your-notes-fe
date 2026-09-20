import { Bell } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { REMINDER_REPEATS, type Reminder, toLocalInput } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';
import type { ReminderRepeat } from '@/models.ts';

type ReminderButtonProps = {
  reminder?: Reminder;
  /** Resolves true when the Reminder was handed off and saved; false leaves the popover open. */
  onSet: (next: Reminder) => Promise<boolean>;
  onClear: () => void;
  className?: string;
};

const FIELD =
  'h-9 w-full rounded-control border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The one place a Reminder is set (ADR 0021).
 *
 * There is a single primary action and it both saves and hands off, because a
 * Reminder the calendar was never offered is a chip that promises an alarm
 * nothing will sound. The inputs are the platform's own: a phone brings its
 * native date wheel, and no picker library is involved.
 */
export function ReminderButton({ reminder, onSet, onClear, className }: ReminderButtonProps) {
  const { t } = useTranslation();
  const whenId = useId();
  const repeatId = useId();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat | 'none'>('none');
  const [busy, setBusy] = useState(false);

  const handleOpenChange = (next: boolean) => {
    // Re-seed from the stored Reminder on every open, so an abandoned edit
    // does not come back as if it had been saved.
    if (next) {
      setWhen(reminder?.remindAt ?? '');
      setRepeat(reminder?.repeat ?? 'none');
    }
    setOpen(next);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const saved = await onSet({
        remindAt: when,
        repeat: repeat === 'none' ? undefined : repeat,
      });
      if (saved) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    // `modal` for the same reason as TagPopover: inside the editor's Dialog a
    // non-modal popover is outside react-remove-scroll's shard.
    <Popover modal open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('reminders.button')}
          aria-pressed={Boolean(reminder)}
          className={cn(
            className,
            reminder &&
              'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
          )}
        >
          <Bell className={cn('size-4', reminder && 'fill-current')} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <div className="space-y-1">
          <label htmlFor={whenId} className="text-muted-foreground text-xs">
            {t('reminders.when')}
          </label>
          <input
            id={whenId}
            type="datetime-local"
            value={when}
            min={toLocalInput(new Date())}
            onChange={(e) => setWhen(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={repeatId} className="text-muted-foreground text-xs">
            {t('reminders.repeat')}
          </label>
          <select
            id={repeatId}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat | 'none')}
            className={FIELD}
          >
            <option value="none">{t('reminders.repeats.none')}</option>
            {REMINDER_REPEATS.map((value) => (
              <option key={value} value={value}>
                {t(`reminders.repeats.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-muted-foreground text-xs">{t('reminders.oneWay')}</p>

        <div className="flex items-center justify-between gap-2">
          {reminder ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              {t('reminders.clear')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" disabled={!when || busy} onClick={() => void submit()}>
            {t(reminder ? 'reminders.updateCalendar' : 'reminders.addToCalendar')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
