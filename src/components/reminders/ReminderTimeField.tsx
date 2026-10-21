import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils.ts';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTE_STEP = 5;

/** Five-minute steps, plus the given minute when it falls between them, so a stored time survives. */
export function minuteOptions(current: string): string[] {
  const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad(i * MINUTE_STEP));
  return current && !steps.includes(current) ? [...steps, current].sort() : steps;
}

type ReminderTimeFieldProps = {
  hour: string;
  minute: string;
  onChange: (hour: string, minute: string) => void;
  className: string;
};

/**
 * Two selects rather than `<input type="time">`, which draws AM/PM whenever the OS locale does
 * and ignores `lang`.
 */
export function ReminderTimeField({ hour, minute, onChange, className }: ReminderTimeFieldProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-muted-foreground text-xs">{t('reminders.time')}</legend>
      <div className="flex gap-1">
        <select
          aria-label={t('reminders.hour')}
          value={hour}
          // One pick is a whole time: the minute starts on the hour.
          onChange={(e) => onChange(e.target.value, minute || '00')}
          className={cn(className, 'w-15')}
        >
          <option value="" disabled>
            --
          </option>
          {HOURS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={t('reminders.minute')}
          value={minute}
          onChange={(e) => onChange(hour, e.target.value)}
          className={cn(className, 'w-15')}
        >
          <option value="" disabled>
            --
          </option>
          {minuteOptions(minute).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
