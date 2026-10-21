import { Bell } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { type Reminder, toLocalInput } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';
import { REMINDER_REPEATS, type ReminderRepeat } from '@/models.ts';

type ReminderButtonProps = {
  reminder?: Reminder;
  /** Resolves true when the Reminder was handed off and saved; false leaves the popover open. */
  onSet: (next: Reminder) => Promise<boolean>;
  onClear: () => void;
  className?: string;
};

// `dark:[color-scheme:dark]` is the only way into the UA-drawn parts of native controls (picker
// glyph, select arrow, picker panel), which otherwise paint black-on-black at night.
const FIELD =
  'h-9 w-full rounded-control border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:[color-scheme:dark]';

const today = () => toLocalInput(new Date()).slice(0, 10);

/**
 * One primary action that both saves and hands off (ADR 0021): a Reminder the calendar was
 * never offered would promise an alarm nothing sounds. Native inputs, no picker library.
 */
export function ReminderButton({ reminder, onSet, onClear, className }: ReminderButtonProps) {
  const { t } = useTranslation();
  const dateId = useId();
  const timeId = useId();
  const repeatId = useId();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat | 'none'>('none');
  const [busy, setBusy] = useState(false);

  const handleOpenChange = (next: boolean) => {
    // Re-seed from the stored Reminder on every open, so an abandoned edit
    // does not come back as if it had been saved.
    if (next) {
      const [storedDate, storedTime = ''] = reminder?.remindAt.split('T') ?? [today()];
      setDate(storedDate);
      setTime(storedTime);
      setRepeat(reminder?.repeat ?? 'none');
    }
    setOpen(next);
  };

  const when = date && time ? `${date}T${time}` : '';

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
      <IconTooltip label={t('reminders.button')}>
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
      </IconTooltip>
      <PopoverContent align="end" data-testid="reminder-popover" className="w-80 space-y-3 p-3">
        {/* Two fields, not one datetime-local: Firefox reports that as empty until both halves
            are picked, so a new Reminder could not start on today (feedback B2). */}
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <div className="space-y-1">
            <label htmlFor={dateId} className="text-muted-foreground text-xs">
              {t('reminders.date')}
            </label>
            <input
              id={dateId}
              type="date"
              value={date}
              min={today()}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={timeId} className="text-muted-foreground text-xs">
              {t('reminders.time')}
            </label>
            <input
              id={timeId}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={FIELD}
            />
          </div>
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

        {/* Stacked, not side by side (CLAUDE.md, Reminders). The primary keeps its whole sentence:
            it is the only place the user learns a Reminder goes to their calendar. */}
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!when || busy}
            onClick={() => void submit()}
          >
            {t(reminder ? 'reminders.updateCalendar' : 'reminders.addToCalendar')}
          </Button>
          {reminder && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              {t('reminders.clear')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
