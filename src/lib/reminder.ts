import type { Note, ReminderRepeat } from '@/models.ts';

/** A Reminder as the UI passes it around; on the Note it is two flat fields. */
export type Reminder = { remindAt: string; repeat?: ReminderRepeat };

export const REMINDER_REPEATS: readonly ReminderRepeat[] = ['daily', 'weekly', 'monthly', 'yearly'];

const REMIND_AT_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * A backup's `remindAt` is unvalidated (`noteSchema` is a loose schema), so a
 * hand-edited or foreign archive can put any string there. This is the one
 * gate every reader of the field goes through - the chip, the bell and the
 * `.ics` - so a malformed value never reaches `Intl.DateTimeFormat` or `Date`,
 * either of which can throw or silently misread it.
 */
export function reminderOf(note: Pick<Note, 'remindAt' | 'repeat'>): Reminder | undefined {
  if (!note.remindAt || !REMIND_AT_SHAPE.test(note.remindAt)) return undefined;
  if (Number.isNaN(new Date(note.remindAt).getTime())) return undefined;
  return { remindAt: note.remindAt, repeat: note.repeat };
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
