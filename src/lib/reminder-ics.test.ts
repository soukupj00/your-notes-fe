import { describe, expect, it } from 'vitest';
import { buildReminderIcs, reminderFile } from './reminder-ics.ts';

const base = {
  noteId: '3f2b8c1e-0000-4000-8000-000000000001',
  header: 'Call the dentist',
  body: '<p>secret body text</p>',
  reminder: { remindAt: '2030-03-04T09:00' },
  origin: 'https://notes.example',
  fallbackTitle: 'YouNotes reminder',
  now: new Date('2030-01-01T12:00:00Z'),
};

const lines = (ics: string) => ics.split('\r\n');

describe('buildReminderIcs', () => {
  it('is one event in one calendar, CRLF-terminated', () => {
    const ics = buildReminderIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('uses the note id as UID so a second hand-off replaces the first', () => {
    expect(lines(buildReminderIcs(base))).toContain(`UID:${base.noteId}`);
  });

  it('raises SEQUENCE with time, without storing a counter', () => {
    const seq = (now: Date) =>
      Number(/SEQUENCE:(\d+)/.exec(buildReminderIcs({ ...base, now }))?.[1]);
    expect(seq(new Date('2030-01-01T12:00:01Z'))).toBeGreaterThan(
      seq(new Date('2030-01-01T12:00:00Z'))
    );
  });

  it('writes the start as a floating time: no Z, no TZID', () => {
    const ics = buildReminderIcs(base);
    expect(lines(ics)).toContain('DTSTART:20300304T090000');
    expect(ics).not.toContain('TZID');
    expect(ics).not.toContain('VTIMEZONE');
  });

  it('has no RRULE for a one-shot and exactly one per repeat', () => {
    expect(buildReminderIcs(base)).not.toContain('RRULE');
    for (const [repeat, freq] of [
      ['daily', 'DAILY'],
      ['weekly', 'WEEKLY'],
      ['monthly', 'MONTHLY'],
      ['yearly', 'YEARLY'],
    ] as const) {
      const ics = buildReminderIcs({ ...base, reminder: { ...base.reminder, repeat } });
      expect(lines(ics)).toContain(`RRULE:FREQ=${freq}`);
    }
  });

  it('carries an alarm at the event time, for calendars that honour one', () => {
    const ics = buildReminderIcs(base);
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\n');
    expect(lines(ics)).toContain('TRIGGER:PT0S');
  });

  it('links back to the Note and never carries the Body', () => {
    const ics = buildReminderIcs(base);
    expect(lines(ics)).toContain(`URL:https://notes.example/?note=${base.noteId}`);
    expect(ics).not.toContain('secret');
  });

  it('falls back from header to the start of the body text to a fixed title', () => {
    const long = `<p>${'word '.repeat(40)}</p>`;
    const fromBody = buildReminderIcs({ ...base, header: '  ', body: long });
    const summary = lines(fromBody).find((l) => l.startsWith('SUMMARY:')) ?? '';
    expect(summary.length).toBeLessThanOrEqual('SUMMARY:'.length + 60);
    expect(summary).toContain('word word');

    const empty = buildReminderIcs({ ...base, header: undefined, body: '' });
    expect(lines(empty)).toContain('SUMMARY:YouNotes reminder');
  });

  it('escapes TEXT: backslash, semicolon, comma and newline', () => {
    const ics = buildReminderIcs({ ...base, header: 'a\\b; c, d\ne' });
    expect(lines(ics)).toContain('SUMMARY:a\\\\b\\; c\\, d\\ne');
  });

  it('escapes a lone carriage return the same as a newline', () => {
    const ics = buildReminderIcs({ ...base, header: 'a\rb' });
    expect(lines(ics)).toContain('SUMMARY:a\\nb');
  });

  it('folds at 75 octets without splitting a UTF-8 sequence', () => {
    const ics = buildReminderIcs({ ...base, header: 'ž'.repeat(60) });
    const bytes = new TextEncoder();
    for (const line of lines(ics)) expect(bytes.encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding (drop CRLF + one space) gives the original text back intact.
    expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${'ž'.repeat(60)}`);
  });
});

describe('reminderFile', () => {
  it('is a text/calendar file with a stable name', () => {
    const file = reminderFile('BEGIN:VCALENDAR');
    expect(file.name).toBe('reminder.ics');
    expect(file.type).toBe('text/calendar');
  });
});
