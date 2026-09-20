import type { Reminder } from '@/lib/reminder.ts';
import { stripHtml } from '@/lib/utils.ts';

/**
 * The calendar file for a Hand-off (ADR 0021), written by hand on purpose.
 *
 * iCalendar is hard where it has time zones, recurrence expansion and parsing.
 * This event has none of the three: the start is a floating wall-clock time,
 * the calendar expands the one RRULE, and nothing is ever read back. What is
 * left - a dozen fixed lines, TEXT escaping and folding - is smaller than any
 * library's input validation. See the plan of 2026-09-20 for the survey.
 */
export type ReminderEvent = {
  noteId: string;
  header?: string;
  body?: string;
  reminder: Reminder;
  /** `location.origin` - an argument so the module stays pure. */
  origin: string;
  /** Translated title for a Note with neither a header nor any text. */
  fallbackTitle: string;
  now?: Date;
};

const SUMMARY_MAX = 60;

/** RFC 5545 §3.3.11 TEXT. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** RFC 5545 §3.1: lines of at most 75 octets; a continuation starts with a space.
 *  Iterating by code point keeps a multi-byte character on one side of the fold. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > 75) {
      out.push(current);
      current = ' ';
      octets = 1;
    }
    current += char;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

/** `2030-03-04T09:00` -> `20300304T090000`. No `Z`: a floating time. */
function floating(remindAt: string): string {
  return `${remindAt.replace(/[-:]/g, '')}00`;
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function summaryOf({ header, body, fallbackTitle }: ReminderEvent): string {
  const title = header?.trim();
  if (title) return title;
  // By code point, so the cut never lands inside a surrogate pair.
  const text = Array.from(stripHtml(body)).slice(0, SUMMARY_MAX).join('').trim();
  return text || fallbackTitle;
}

export function buildReminderIcs(event: ReminderEvent): string {
  const now = event.now ?? new Date();
  const summary = escapeText(summaryOf(event));
  const url = `${event.origin}/?note=${event.noteId}`;
  const { remindAt, repeat } = event.reminder;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YouNotes//Reminder//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // The Note's id, so handing off again replaces the event where the
    // calendar honours UID + SEQUENCE, instead of adding a second one.
    `UID:${event.noteId}`,
    `DTSTAMP:${utcStamp(now)}`,
    // ponytail: epoch seconds stand in for a stored counter; SEQUENCE is an
    // int32, so this overflows in 2038 - store a real counter before then.
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTART:${floating(remindAt)}`,
    ...(repeat ? [`RRULE:FREQ=${repeat.toUpperCase()}`] : []),
    `SUMMARY:${summary}`,
    `DESCRIPTION:${escapeText(url)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function reminderFile(ics: string): File {
  return new File([ics], 'reminder.ics', { type: 'text/calendar' });
}
