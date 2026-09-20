import type { Note, ReminderRepeat } from '@/models.ts';

/** A Reminder as the UI passes it around; on the Note it is two flat fields. */
export type Reminder = { remindAt: string; repeat?: ReminderRepeat };

export const REMINDER_REPEATS: readonly ReminderRepeat[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function reminderOf(note: Pick<Note, 'remindAt' | 'repeat'>): Reminder | undefined {
  return note.remindAt ? { remindAt: note.remindAt, repeat: note.repeat } : undefined;
}

/** A Date as `<input type="datetime-local">` spells it: local parts, to the minute. */
export function toLocalInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Only a one-shot can be past. A repeating Reminder is still being fired by the
 * calendar, so muting it on the Card would say something false.
 *
 * `new Date('YYYY-MM-DDTHH:mm')` - no zone suffix - is parsed as local time by
 * the spec, which is exactly the wall-clock reading the field stores.
 */
export function isReminderPast(reminder: Reminder, now = new Date()): boolean {
  return !reminder.repeat && new Date(reminder.remindAt) < now;
}

/**
 * No `weekday`: it is the one part the reader can derive from the date, and in
 * en it costs the chip ~36px of an ~86px text budget at phone width - so the
 * run that gets cut is the time, which is the whole point of the record.
 */
export function formatReminderTime(remindAt: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(remindAt));
}
