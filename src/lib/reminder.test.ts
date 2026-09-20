import { describe, expect, it } from 'vitest';
import { formatReminderTime, isReminderPast, reminderOf, toLocalInput } from './reminder.ts';

describe('toLocalInput', () => {
  it('renders the wall clock, not UTC, in the datetime-local shape', () => {
    // Built from local parts, so this holds in whatever zone the suite runs in.
    expect(toLocalInput(new Date(2030, 2, 4, 9, 5))).toBe('2030-03-04T09:05');
  });
});

describe('isReminderPast', () => {
  const now = new Date(2030, 2, 4, 9, 0);

  it('is past once a one-shot time has gone', () => {
    expect(isReminderPast({ remindAt: '2030-03-04T08:59' }, now)).toBe(true);
    expect(isReminderPast({ remindAt: '2030-03-04T09:01' }, now)).toBe(false);
  });

  it('is never past while it repeats - the calendar is still firing it', () => {
    expect(isReminderPast({ remindAt: '2020-01-01T08:00', repeat: 'daily' }, now)).toBe(false);
  });
});

describe('reminderOf', () => {
  it('is undefined for a Note with no Reminder', () => {
    expect(reminderOf({})).toBeUndefined();
  });

  it('lifts the two fields off the Note', () => {
    expect(reminderOf({ remindAt: '2030-03-04T09:00', repeat: 'weekly' })).toEqual({
      remindAt: '2030-03-04T09:00',
      repeat: 'weekly',
    });
  });
});

describe('formatReminderTime', () => {
  it('reads the stored string as local time, hour without a leading zero', () => {
    const label = formatReminderTime('2030-03-04T09:00', 'en-GB');
    expect(label).toContain('9:00');
    expect(label).not.toContain('09:00');
    expect(label).toContain('4 Mar');
  });

  it('leaves the weekday out, so the time is never what the chip cuts', () => {
    // Measured, not guessed: with `weekday: 'short'` the en label wants ~122px
    // of the ~86px a chip gets on a 390px card, and what overflows is the tail
    // - the time, which is the whole record.
    expect(formatReminderTime('2030-03-04T09:00', 'en-GB')).not.toContain('Mon');
  });
});
