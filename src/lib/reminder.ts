import type { Note, ReminderRepeat } from '@/models.ts';
import { formatDate } from './format.ts';

/** A Reminder as the UI passes it around; on the Note it is two flat fields. */
export type Reminder = { remindAt: string; repeat?: ReminderRepeat };

const REMIND_AT_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** How long a one-shot stays on show, struck through, after its time has gone. */
const PAST_REMINDER_SHOWN_MS = 24 * 60 * 60 * 1000;

/**
 * The one gate for the chip, the bell and the `.ics`: a backup's `remindAt` is unvalidated, and a
 * malformed value would throw in `Intl` or `Date`. A one-shot over a day past reads as none, a view
 * and never a write, with no timer (CLAUDE.md "Reminders", ADR 0021).
 */
export function reminderOf(
  note: Pick<Note, 'remindAt' | 'repeat'>,
  now = new Date()
): Reminder | undefined {
  if (!note.remindAt || !REMIND_AT_SHAPE.test(note.remindAt)) return undefined;
  const at = new Date(note.remindAt).getTime();
  if (Number.isNaN(at)) return undefined;
  if (!note.repeat && now.getTime() - at > PAST_REMINDER_SHOWN_MS) return undefined;
  return { remindAt: note.remindAt, repeat: note.repeat };
}

/** A Date as `<input type="datetime-local">` spells it: local parts, to the minute. */
export function toLocalInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Only a one-shot can be past: the calendar is still firing a repeating one. `new Date()` parses a
 * zone-less `YYYY-MM-DDTHH:mm` as local time, which is the wall clock the field stores.
 */
export function isReminderPast(reminder: Reminder, now = new Date()): boolean {
  return !reminder.repeat && new Date(reminder.remindAt) < now;
}

const REMINDER_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  // The picker is 24-hour in every locale, so the record matches it.
  hourCycle: 'h23',
};

/**
 * No `weekday`: it is the one part the reader can derive from the date, and in
 * en it costs the chip ~36px of an ~86px text budget at phone width - so the
 * run that gets cut is the time, which is the whole point of the record.
 */
export function formatReminderTime(remindAt: string, locale: string): string {
  return formatDate(remindAt, locale, REMINDER_TIME);
}
