# Reminders with Calendar Hand-off - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can put a one-shot or repeating Reminder on a Note from the editor, and the same tap hands it to their calendar as an `.ics`, so it fires whether or not the app is running.

**Architecture:** A Reminder is two optional, unindexed fields on the Note (`remindAt`, `repeat`), written through the existing `updateNote`.
Three pure modules carry the logic: `lib/reminder.ts` (time helpers), `lib/reminder-ics.ts` (the iCalendar text) and `lib/hand-off.ts` (share-or-download, the one place the unverified device behaviour lives).
One presentational `ReminderButton` (bell + popover with native inputs) sits in `NoteEditorBar`; a read-only `ReminderChip` sits on the Card.
The app never notifies: no Notification permission, no service-worker change, no timers.

**Tech Stack:** React 19, Radix Popover (vendored shadcn), native `<input type="datetime-local">` and `<select>`, `Intl.DateTimeFormat`, Web Share API Level 2, Vitest + jsdom, Playwright, i18next. **No new dependency** - see "Library decision" below.

**Spec:** [ADR 0021](../../adr/0021-reminders-are-handed-off-to-the-calendar.md).
Glossary terms **Reminder** and **Hand-off** in [`CONTEXT.md`](../../../CONTEXT.md).
FR15 in [`docs/architecture/07-requirements.md`](../../architecture/07-requirements.md).

## Global Constraints

- Package manager is `pnpm`; never npm or yarn.
- Never use the em dash; plain `-` only, in code, comments, docs and translations.
- Never add a `Co-Authored-By` trailer to commits.
- `pnpm check` (Biome), `pnpm test` and `pnpm build` must pass before every commit.
- Keep files under 500 lines.
- Every user-facing string goes in **both** `public/locales/en/translation.json` and `public/locales/cs/translation.json`; `src/i18n.test.ts` fails otherwise.
- The app raises no notification of any kind. Nothing in this plan may call `Notification`, `registration.showNotification`, or touch the service worker.
- `remindAt` is a local wall-clock string `YYYY-MM-DDTHH:mm` - never converted to UTC, never given a `Z`. This is a deliberate exception to the ISO-timestamp convention (ADR 0021 point 6).
- The `.ics` carries the Note's title and a link back, **never the Body**.
- Setting is handing off: there is no code path that saves `remindAt` without calling `handOff`, and a cancelled share saves nothing.
- No Dexie version bump: neither field is indexed.
- Coarse pointer means `matchMedia('(pointer: coarse)')`, never a viewport width.

## Library decision: write the `.ics` by hand

Surveyed on 2026-09-20 from the npm registry (weekly downloads, runtime deps, unpacked size, last publish):

| Package | Weekly dl | Runtime deps | Unpacked | Fit |
|---|---|---|---|---|
| `ics` 3.12 | 451k | `yup`, `nanoid`, `runes2` | 72 kB (+ yup) | Does floating time, `recurrenceRule`, `uid`, `sequence`, `url`. Ships a whole schema validator (`yup`) to validate input this app constructs itself; the repo already standardises on Zod. |
| `ical-generator` 11 | 460k | none | 814 kB | Most complete and best maintained; aimed at servers publishing feeds. Floating time is supported but the API is built around timezone-aware date objects (Luxon/Day.js/moment adapters), the opposite of what ADR 0021 wants. |
| `ts-ics` 2.4 | 80k | `@standard-schema/spec` | 191 kB | Typed generate + parse. The parse half is dead weight: the Hand-off is one-way by decision. |
| `ical.js` 2.2 | 392k | none | 1.2 MB | A parser (Mozilla). Wrong direction. |
| `calendar-link` 2.11 | 109k | `dayjs` | 146 kB | Builds Google/Outlook/Yahoo URLs and a basic `.ics`. Worth remembering only if on-device testing forces the Google-template-link fallback. |
| `datebook` 8 | 23k | none | 269 kB | Last published 2023-06. Stale. |
| `add-to-calendar-button` 3.1 | 68k | `lit`, `timezones-ical-library` | 3.6 MB | A whole web-component UI, and **Elastic License 2.0** - not open source, which rules it out for an open-source project on licence alone. |

**Decision: no package.**
What makes iCalendar hard is `VTIMEZONE` blocks, expanding recurrences, and parsing other people's files.
ADR 0021 designed all three away: times are floating, the calendar expands the `RRULE`, and nothing is ever read back.
What is left is ~12 fixed property lines, TEXT escaping (4 characters) and line folding at 75 octets - about 50 lines, fully covered by the tests in Task 2.
The one genuinely subtle rule, folding without splitting a UTF-8 sequence, is the same amount of work to *verify* in a library as to write.
Revisit if the feature ever grows an event with attendees, time zones, or import.

## File structure

```
src/models.ts                                          Note gains remindAt, repeat; ReminderRepeat type      (Task 2)
src/lib/reminder.ts (+ .test.ts)                       Reminder type, toLocalInput, isReminderPast, format   (Task 2)
src/lib/reminder-ics.ts (+ .test.ts)                   buildReminderIcs(): the iCalendar text                (Task 3)
src/lib/hand-off.ts (+ .test.ts)                       handOff(file): share on coarse pointers, else download (Task 4)
src/lib/backup.ts                                      export the existing downloadBlob                       (Task 4)
src/lib/backup.test.ts                                 fixture note carries a Reminder through the round-trip (Task 2)
src/components/reminders/ReminderButton.tsx (+ .test)  bell + popover; presentational                        (Task 5)
src/components/reminders/ReminderChip.tsx (+ .test)    read-only chip for the Card                            (Task 7)
src/components/notes/NoteEditorBar.tsx                 mounts ReminderButton                                  (Task 6)
src/components/notes/NoteEditorDialog.tsx              reminder state, load, handleReminderSet/Clear          (Task 6)
src/components/cards/NoteCard.tsx                      mounts ReminderChip beside TagPills                    (Task 7)
public/locales/{en,cs}/translation.json                "reminders" block                                      (Task 5)
e2e/reminder.spec.ts                                   acceptance test, written first                         (Tasks 1, 8)
CLAUDE.md                                              "Reminders" architecture section                       (Task 8)
```

---

### Task 1: The acceptance test, red

Written before the feature, per the repo's TDD rule for user flows.
It stays red until Task 7 and is the definition of done.

**Files:**
- Create: `e2e/reminder.spec.ts`

**Interfaces:**
- Produces (the contract later tasks must meet):
  - a button named `Reminder` in the open editor,
  - inside its popover: a field labelled `Date and time`, a select labelled `Repeat` with option values `none | daily | weekly | monthly | yearly`, a button `Add to calendar`, and (once set) a button `Clear reminder`,
  - a Card chip carrying `data-testid="reminder-chip"`,
  - a downloaded file named `reminder.ics`.

- [ ] **Step 1: Write the spec**

```ts
import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * Reminders' acceptance test (ADR 0021), written before the feature.
 *
 * The app never notifies, so there is nothing to wait for at the reminder's
 * time. What can be pinned is the Hand-off: the tap that sets a Reminder must
 * produce a calendar file, and the record must survive on the Card.
 */

/** A fresh profile is offered the Tour, which makes the whole app inert. */
async function freshWall(page: Page) {
  await page.goto('/');
  await page.getByTestId('tour-popover').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('No notes yet')).toBeVisible();
}

async function openNewNote(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'New note' }).click();
    await page.getByRole('button', { name: 'Note', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Take a note…' }).click();
  }
  await page.getByRole('textbox', { name: 'Title' }).fill('Call the dentist');
}

async function setWeeklyReminder(page: Page) {
  await page.getByRole('button', { name: 'Reminder' }).click();
  await page.getByLabel('Date and time').fill('2030-03-04T09:00');
  await page.getByLabel('Repeat').selectOption('weekly');
}

test.describe('Reminders', () => {
  test('setting one hands a calendar file over and leaves a chip on the Card', async ({
    page,
    isMobile,
  }) => {
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe('reminder.ics');
    const ics = await readFile(await download.path(), 'utf8');
    expect(ics).toContain('SUMMARY:Call the dentist');
    expect(ics).toContain('DTSTART:20300304T090000\r\n'); // floating: no Z
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toMatch(/URL:http:\/\/[^\r]+\?note=[0-9a-f-]{36}/);

    // The open Note lives in the URL (ADR 0014), so back closes the editor.
    await page.goBack();
    const chip = page.getByTestId('reminder-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('09:00');

    await page.reload();
    await expect(page.getByTestId('reminder-chip')).toBeVisible();
  });

  test('clearing removes the chip', async ({ page, isMobile }) => {
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    await downloading;

    await page.getByRole('button', { name: 'Reminder' }).click();
    await page.getByRole('button', { name: 'Clear reminder' }).click();
    await page.goBack();

    await expect(page.getByText('Call the dentist')).toBeVisible();
    await expect(page.getByTestId('reminder-chip')).toHaveCount(0);
  });

  test('on a phone that can share files, the calendar file goes to the share sheet', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'sharing is only attempted on a coarse pointer');
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: { name: string; type: string }[] };
      w.__shared = [];
      navigator.canShare = () => true;
      navigator.share = async (data?: ShareData) => {
        for (const f of data?.files ?? []) w.__shared.push({ name: f.name, type: f.type });
      };
    });
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    await page.getByRole('button', { name: 'Add to calendar' }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
      .toEqual([{ name: 'reminder.ics', type: 'text/calendar' }]);
  });

  test('a cancelled share saves nothing', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sharing is only attempted on a coarse pointer');
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = async () => {
        throw new DOMException('cancelled', 'AbortError');
      };
    });
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    await page.keyboard.press('Escape');
    await page.goBack();

    await expect(page.getByText('Call the dentist')).toBeVisible();
    await expect(page.getByTestId('reminder-chip')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it is red for the right reason**

Run: `pnpm test:e2e e2e/reminder.spec.ts`
Expected: every test FAILS at `getByRole('button', { name: 'Reminder' })` timing out.
If a test fails *earlier* (the Tour's Skip, opening a note), fix the helper now - those parts must already be green.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/reminders-calendar-hand-off
git add e2e/reminder.spec.ts
git commit -m "[ADD] Reminders acceptance test: the tap that sets one hands over a calendar file (red)"
```

---

### Task 2: The model and its time helpers

**Files:**
- Modify: `src/models.ts` (the `Note` interface)
- Create: `src/lib/reminder.ts`, `src/lib/reminder.test.ts`
- Modify: `src/lib/backup.test.ts:19-28` (the `note` fixture)

**Interfaces:**
- Produces:
  - `type ReminderRepeat = 'daily' | 'weekly' | 'monthly' | 'yearly'` (from `@/models.ts`)
  - `Note.remindAt?: string`, `Note.repeat?: ReminderRepeat`
  - `type Reminder = { remindAt: string; repeat?: ReminderRepeat }`
  - `REMINDER_REPEATS: readonly ReminderRepeat[]`
  - `reminderOf(note: Pick<Note, 'remindAt' | 'repeat'>): Reminder | undefined`
  - `toLocalInput(date: Date): string`
  - `isReminderPast(reminder: Reminder, now?: Date): boolean`
  - `formatReminderTime(remindAt: string, locale: string): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/reminder.test.ts`:

```ts
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
  it('reads the stored string as local time', () => {
    const label = formatReminderTime('2030-03-04T09:00', 'en-GB');
    expect(label).toContain('09:00');
    expect(label).toContain('4 Mar');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/reminder.test.ts`
Expected: FAIL - cannot resolve `./reminder.ts`.

- [ ] **Step 3: Add the fields to the model**

In `src/models.ts`, above `export interface Note`:

```ts
/** How often a Reminder repeats; absent means it happens once. */
export type ReminderRepeat = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

Inside `Note`, after `trashedAt`:

```ts
  // A Reminder (CONTEXT.md, ADR 0021). The app records it and never sounds it -
  // the alarm belongs to the calendar it was handed to.
  remindAt?: string; // LOCAL wall clock 'YYYY-MM-DDTHH:mm', deliberately not ISO/UTC: 09:00 stays 09:00 across DST
  repeat?: ReminderRepeat; // absent = one-shot
```

- [ ] **Step 4: Write `src/lib/reminder.ts`**

```ts
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

export function formatReminderTime(remindAt: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(remindAt));
}
```

- [ ] **Step 5: Make Backup carry it**

In `src/lib/backup.test.ts`, add two lines to the `note` fixture after `color: 'sage',`:

```ts
  remindAt: '2030-03-04T09:00',
  repeat: 'weekly',
```

The existing `round-trips notes, tags, relations and binary attachments` test asserts `toEqual([note])`, so this is the whole gate; `noteSchema` is a `z.looseObject`, so no schema change is expected.

- [ ] **Step 6: Run the tests**

Run: `pnpm test src/lib/reminder.test.ts src/lib/backup.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/models.ts src/lib/reminder.ts src/lib/reminder.test.ts src/lib/backup.test.ts
git commit -m "[ADD] A Note can carry a Reminder: a wall-clock time and an optional repeat, carried by Backup"
```

---

### Task 3: The calendar file

**Files:**
- Create: `src/lib/reminder-ics.ts`, `src/lib/reminder-ics.test.ts`

**Interfaces:**
- Consumes: `Reminder` from `@/lib/reminder.ts`; `stripHtml` from `@/lib/utils.ts`.
- Produces:
  - `type ReminderEvent = { noteId: string; header?: string; body?: string; reminder: Reminder; origin: string; fallbackTitle: string; now?: Date }`
  - `buildReminderIcs(event: ReminderEvent): string`
  - `reminderFile(ics: string): File` - named `reminder.ics`, type `text/calendar`

- [ ] **Step 1: Write the failing tests**

`src/lib/reminder-ics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/reminder-ics.test.ts`
Expected: FAIL - cannot resolve `./reminder-ics.ts`.

- [ ] **Step 3: Write `src/lib/reminder-ics.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/reminder-ics.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminder-ics.ts src/lib/reminder-ics.test.ts
git commit -m "[ADD] A Reminder's calendar file: floating start, one RRULE, title and link back, never the Body"
```

---

### Task 4: `handOff` - the one seam around the unverified device behaviour

**Files:**
- Modify: `src/lib/backup.ts:262` (`function downloadBlob` becomes `export function downloadBlob`)
- Create: `src/lib/hand-off.ts`, `src/lib/hand-off.test.ts`

**Interfaces:**
- Consumes: `downloadBlob(blob: Blob, filename: string): void` from `@/lib/backup.ts`.
- Produces:
  - `type HandOffResult = 'shared' | 'downloaded' | 'cancelled'`
  - `handOff(file: File): Promise<HandOffResult>`

- [ ] **Step 1: Write the failing tests**

`src/lib/hand-off.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handOff } from './hand-off.ts';

const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/backup.ts', () => ({ downloadBlob }));

const file = new File(['BEGIN:VCALENDAR'], 'reminder.ics', { type: 'text/calendar' });

function pointer(coarse: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: coarse } as MediaQueryList);
}

function sharing(share: () => Promise<void>, canShare = () => true) {
  Object.assign(navigator, { share: vi.fn(share), canShare: vi.fn(canShare) });
}

afterEach(() => {
  vi.restoreAllMocks();
  downloadBlob.mockReset();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
});

describe('handOff', () => {
  it('shares the file on a coarse pointer that can share files', async () => {
    pointer(true);
    sharing(async () => {});
    await expect(handOff(file)).resolves.toBe('shared');
    expect(navigator.share).toHaveBeenCalledWith({ files: [file] });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('reports a dismissed share sheet as cancelled and downloads nothing', async () => {
    pointer(true);
    sharing(async () => {
      throw new DOMException('dismissed', 'AbortError');
    });
    await expect(handOff(file)).resolves.toBe('cancelled');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for any other reason', async () => {
    pointer(true);
    sharing(async () => {
      throw new DOMException('nope', 'NotAllowedError');
    });
    await expect(handOff(file)).resolves.toBe('downloaded');
    expect(downloadBlob).toHaveBeenCalledWith(file, 'reminder.ics');
  });

  it('downloads on a fine pointer even where files can be shared', async () => {
    // A desktop share sheet offers mail and nearby devices, not a calendar;
    // an opened .ics goes straight to the desktop calendar app.
    pointer(false);
    sharing(async () => {});
    await expect(handOff(file)).resolves.toBe('downloaded');
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it('downloads where the browser cannot share files at all', async () => {
    pointer(true);
    await expect(handOff(file)).resolves.toBe('downloaded');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/hand-off.test.ts`
Expected: FAIL - cannot resolve `./hand-off.ts`.

- [ ] **Step 3: Export `downloadBlob`**

In `src/lib/backup.ts`, change `function downloadBlob(` to `export function downloadBlob(`. Nothing else.

- [ ] **Step 4: Write `src/lib/hand-off.ts`**

```ts
import { downloadBlob } from '@/lib/backup.ts';

export type HandOffResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Gives a file to whatever on this device can act on it (ADR 0021, Hand-off).
 *
 * This is the one function whose behaviour is NOT verified by the test suite,
 * because what matters - does an installed PWA on Android land the user on the
 * calendar's add-event screen? - only exists on a device. It is isolated here
 * so that answer changes one file. The known third option, if neither path
 * reaches the calendar, is a Google Calendar template link.
 *
 * `cancelled` is a result, not an error: the caller must not record a Reminder
 * the calendar was never given.
 */
export async function handOff(file: File): Promise<HandOffResult> {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Anything else (activation expired, type refused): fall through.
    }
  }
  downloadBlob(file, file.name);
  return 'downloaded';
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test src/lib/hand-off.test.ts src/lib/backup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hand-off.ts src/lib/hand-off.test.ts src/lib/backup.ts
git commit -m "[ADD] handOff: share a file on a phone, download it elsewhere; a dismissed share is a result, not an error"
```

---

### Task 5: `ReminderButton` - the bell and its popover

Presentational: it holds the form's draft and the popover's open state, and knows nothing about notes, stores or `.ics`.

**Files:**
- Create: `src/components/reminders/ReminderButton.tsx`, `src/components/reminders/ReminderButton.test.tsx`
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json`

**Interfaces:**
- Consumes: `Reminder`, `REMINDER_REPEATS`, `toLocalInput` from `@/lib/reminder.ts`; `Popover*` from `@/components/ui/popover.tsx`; `Button` from `@/components/ui/button.tsx`.
- Produces:

```ts
type ReminderButtonProps = {
  reminder?: Reminder;
  /** Resolves true when the Reminder was handed off and saved; false leaves the popover open. */
  onSet: (next: Reminder) => Promise<boolean>;
  onClear: () => void;
  className?: string;
};
export function ReminderButton(props: ReminderButtonProps): JSX.Element;
```

- [ ] **Step 1: Add the strings**

In `public/locales/en/translation.json`, add a top-level block after `"tags"`:

```json
  "reminders": {
    "button": "Reminder",
    "when": "Date and time",
    "repeat": "Repeat",
    "repeats": {
      "none": "Does not repeat",
      "daily": "Daily",
      "weekly": "Weekly",
      "monthly": "Monthly",
      "yearly": "Yearly"
    },
    "addToCalendar": "Add to calendar",
    "updateCalendar": "Update in calendar",
    "clear": "Clear reminder",
    "oneWay": "Your calendar keeps its own copy and does the reminding. Clearing or changing this here does not remove it there.",
    "fallbackTitle": "YouNotes reminder",
    "chip": "Reminder: {{when}}",
    "chipRepeating": "Reminder: {{when}}, {{repeat}}"
  },
```

In `public/locales/cs/translation.json`, the same keys:

```json
  "reminders": {
    "button": "Připomenutí",
    "when": "Datum a čas",
    "repeat": "Opakování",
    "repeats": {
      "none": "Neopakuje se",
      "daily": "Denně",
      "weekly": "Týdně",
      "monthly": "Měsíčně",
      "yearly": "Ročně"
    },
    "addToCalendar": "Přidat do kalendáře",
    "updateCalendar": "Aktualizovat v kalendáři",
    "clear": "Zrušit připomenutí",
    "oneWay": "Kalendář si uchovává vlastní kopii a připomíná sám. Zrušení nebo změna tady ji v kalendáři neodstraní.",
    "fallbackTitle": "Připomenutí z YouNotes",
    "chip": "Připomenutí: {{when}}",
    "chipRepeating": "Připomenutí: {{when}}, {{repeat}}"
  },
```

Run: `pnpm test src/i18n.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing tests**

`src/components/reminders/ReminderButton.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReminderButton } from './ReminderButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const open = async () => userEvent.click(screen.getByRole('button', { name: 'reminders.button' }));

describe('ReminderButton', () => {
  it('reads as pressed only while a Reminder is set', () => {
    const { rerender } = render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'reminders.button' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    rerender(
      <ReminderButton
        reminder={{ remindAt: '2030-03-04T09:00' }}
        onSet={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'reminders.button' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('will not hand off until a time is chosen', async () => {
    render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    await open();
    expect(screen.getByRole('button', { name: 'reminders.addToCalendar' })).toBeDisabled();
  });

  it('hands off the chosen time and repeat, then closes', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();

    // userEvent.type cannot drive a datetime-local in jsdom; change is the
    // event the component listens for.
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));

    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: 'weekly' });
    await waitFor(() => expect(screen.queryByLabelText('reminders.when')).not.toBeInTheDocument());
  });

  it('sends no repeat for a one-shot', async () => {
    const onSet = vi.fn().mockResolvedValue(true);
    render(<ReminderButton onSet={onSet} onClear={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(onSet).toHaveBeenCalledWith({ remindAt: '2030-03-04T09:00', repeat: undefined });
  });

  it('stays open when the hand-off was cancelled', async () => {
    render(<ReminderButton onSet={vi.fn().mockResolvedValue(false)} onClear={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
    expect(await screen.findByLabelText('reminders.when')).toBeInTheDocument();
  });

  it('opens on the stored Reminder, offers to update it, and can clear it', async () => {
    const onClear = vi.fn();
    render(
      <ReminderButton
        reminder={{ remindAt: '2030-03-04T09:00', repeat: 'daily' }}
        onSet={vi.fn()}
        onClear={onClear}
      />
    );
    await open();
    expect(screen.getByLabelText('reminders.when')).toHaveValue('2030-03-04T09:00');
    expect(screen.getByLabelText('reminders.repeat')).toHaveValue('daily');
    expect(screen.getByRole('button', { name: 'reminders.updateCalendar' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'reminders.clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('offers no Clear when there is nothing to clear', async () => {
    render(<ReminderButton onSet={vi.fn()} onClear={vi.fn()} />);
    await open();
    expect(screen.queryByRole('button', { name: 'reminders.clear' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/components/reminders/ReminderButton.test.tsx`
Expected: FAIL - cannot resolve `./ReminderButton.tsx`.

- [ ] **Step 4: Write `src/components/reminders/ReminderButton.tsx`**

```tsx
import { Bell } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { REMINDER_REPEATS, type Reminder, toLocalInput } from '@/lib/reminder.ts';
import type { ReminderRepeat } from '@/models.ts';
import { cn } from '@/lib/utils.ts';

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
```

Note for the acceptance test: once a Reminder exists the primary button reads `Update in calendar`. Task 1's spec only presses `Add to calendar` on a Note that has none, so it is unaffected.

- [ ] **Step 5: Run the tests**

Run: `pnpm test src/components/reminders/ReminderButton.test.tsx`
Expected: PASS (7 tests).
If Biome reorders the imports on `pnpm check`, accept its order.

- [ ] **Step 6: Commit**

```bash
git add src/components/reminders public/locales
git commit -m "[ADD] ReminderButton: one primary action that sets and hands off, on the platform's own date and select inputs"
```

---

### Task 6: Wire it into the editor

**Files:**
- Modify: `src/components/notes/NoteEditorBar.tsx`
- Modify: `src/components/notes/NoteEditorDialog.tsx` (state near line 107, load effect near line 148, handlers after `handlePinToggle` near line 237, `noteBar` near line 268)

**Interfaces:**
- Consumes: `ReminderButton` (Task 5); `buildReminderIcs`, `reminderFile` (Task 3); `handOff` (Task 4); `Reminder`, `reminderOf` (Task 2); the dialog's existing `ensureNoteId`, `updateNote`, `headerRef`, `bodyRef`.
- Produces: `NoteEditorBar` gains props `reminder?: Reminder`, `onReminderSet: (next: Reminder) => Promise<boolean>`, `onReminderClear: () => void`.

- [ ] **Step 1: Extend `NoteEditorBar`**

Add the imports:

```ts
import { ReminderButton } from '@/components/reminders/ReminderButton.tsx';
import type { Reminder } from '@/lib/reminder.ts';
```

Add to `NoteEditorBarProps`:

```ts
  reminder?: Reminder;
  /** Hands the Reminder to the calendar and saves it; false when the user backed out. */
  onReminderSet: (next: Reminder) => Promise<boolean>;
  onReminderClear: () => void;
```

Destructure the three in the function signature, and render the bell as the first control, before `NoteColorButton`:

```tsx
        <ReminderButton
          reminder={reminder}
          onSet={onReminderSet}
          onClear={onReminderClear}
          className={noteControlButton(reducedMotion)}
        />
```

Update the component's doc comment: "It carries **colour, labels and pin, and nothing else**" becomes "It carries **labels, a Reminder, colour and pin, and nothing else**", and add after the draft-test sentence: "A Reminder passes the same test - a draft captured from the FAB can be given one (ADR 0021)."

- [ ] **Step 2: Add state, load and handlers to `NoteEditorDialog`**

Imports:

```ts
import { handOff } from '@/lib/hand-off.ts';
import { type Reminder, reminderOf } from '@/lib/reminder.ts';
import { buildReminderIcs, reminderFile } from '@/lib/reminder-ics.ts';
```

If the dialog does not already have `t`, take it from the `useTranslation()` call it already makes (it renders `t('nav.back')`).

State, beside `color`:

```ts
  const [reminder, setReminder] = useState<Reminder | undefined>(undefined);
```

In the load effect, beside `setColor(n.color);`:

```ts
        setReminder(reminderOf(n));
```

Handlers, after `handlePinToggle`:

```ts
  // Setting IS handing off (ADR 0021): the fields are written only after the
  // calendar has been given the file, and a dismissed share sheet writes
  // nothing. The draft is persisted first because the event's UID and its link
  // back are the Note's id - a few milliseconds, well inside the tap's
  // transient activation, which `navigator.share` needs.
  const handleReminderSet = useCallback(
    async (next: Reminder): Promise<boolean> => {
      const id = await ensureNoteId();
      const ics = buildReminderIcs({
        noteId: id,
        header: headerRef.current,
        body: bodyRef.current,
        reminder: next,
        origin: window.location.origin,
        fallbackTitle: t('reminders.fallbackTitle'),
      });
      if ((await handOff(reminderFile(ics))) === 'cancelled') return false;
      setReminder(next);
      await updateNote(id, { remindAt: next.remindAt, repeat: next.repeat });
      return true;
    },
    [ensureNoteId, updateNote, t]
  );

  const handleReminderClear = useCallback(async () => {
    setReminder(undefined);
    const id = await ensureNoteId();
    await updateNote(id, { remindAt: undefined, repeat: undefined });
  }, [ensureNoteId, updateNote]);
```

Pass them in `noteBar`:

```tsx
      reminder={reminder}
      onReminderSet={handleReminderSet}
      onReminderClear={() => void handleReminderClear()}
```

- [ ] **Step 3: Check the empty-draft rule still holds**

`handleClose` purges a Note that `isEmpty(header, body)`.
A draft that was only given a Reminder has no title and no text, so it is purged on close exactly like a draft that was only coloured - which leaves a calendar event linking to nothing.
That is accepted for this slice and must be **stated, not hidden**: confirm by reading `handleClose` that this is what happens, and leave this comment above `handleReminderSet`:

```ts
  // An otherwise empty draft is still purged on close, as a coloured one is;
  // the calendar event then links to a Note that is gone and the app's
  // not-found path handles the link. Reminding yourself of nothing is rare
  // enough not to earn a rule of its own.
```

- [ ] **Step 4: Run the suites that touch these files**

Run: `pnpm test src/components/notes && pnpm build`
Expected: PASS, and `tsc` reports no errors.
An existing `NoteEditorDialog` test that renders `NoteEditorBar` directly with a fixed prop list will fail to typecheck; give it `onReminderSet={vi.fn()}` and `onReminderClear={vi.fn()}`.

- [ ] **Step 5: Run the acceptance test**

Run: `pnpm test:e2e e2e/reminder.spec.ts`
Expected: the download assertions and both share tests now pass; the two tests that look for `reminder-chip` still FAIL there. That is Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/components/notes
git commit -m "[ADD] The editor's note bar sets a Reminder: persist the draft, hand the calendar its file, then record it"
```

---

### Task 7: The Card's chip

**Files:**
- Create: `src/components/reminders/ReminderChip.tsx`, `src/components/reminders/ReminderChip.test.tsx`
- Modify: `src/components/cards/NoteCard.tsx:273` (the foot row)

**Interfaces:**
- Consumes: `Reminder`, `formatReminderTime`, `isReminderPast` from `@/lib/reminder.ts`.
- Produces: `ReminderChip({ reminder, now? }: { reminder: Reminder; now?: Date })`, rendering `data-testid="reminder-chip"` and `data-past="true|false"`.

- [ ] **Step 1: Write the failing tests**

`src/components/reminders/ReminderChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReminderChip } from './ReminderChip.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}|${Object.values(vars).join('|')}` : key,
    i18n: { language: 'en-GB' },
  }),
}));

const now = new Date(2030, 2, 4, 12, 0);

describe('ReminderChip', () => {
  it('names itself for assistive tech and shows the time', () => {
    render(<ReminderChip reminder={{ remindAt: '2030-03-05T09:00' }} now={now} />);
    const chip = screen.getByTestId('reminder-chip');
    expect(chip).toHaveAccessibleName(/^reminders\.chip\|.*09:00/);
    expect(chip).toHaveTextContent('09:00');
    expect(chip).toHaveAttribute('data-past', 'false');
  });

  it('is muted once a one-shot has passed', () => {
    render(<ReminderChip reminder={{ remindAt: '2030-03-04T09:00' }} now={now} />);
    expect(screen.getByTestId('reminder-chip')).toHaveAttribute('data-past', 'true');
  });

  it('says how it repeats, and is never past', () => {
    render(
      <ReminderChip reminder={{ remindAt: '2020-01-01T09:00', repeat: 'weekly' }} now={now} />
    );
    const chip = screen.getByTestId('reminder-chip');
    expect(chip).toHaveTextContent('reminders.repeats.weekly');
    expect(chip).toHaveAttribute('data-past', 'false');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/reminders/ReminderChip.test.tsx`
Expected: FAIL - cannot resolve `./ReminderChip.tsx`.

- [ ] **Step 3: Write `src/components/reminders/ReminderChip.tsx`**

```tsx
import { Bell, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatReminderTime, isReminderPast, type Reminder } from '@/lib/reminder.ts';
import { cn } from '@/lib/utils.ts';

/**
 * A Note's Reminder as the Card shows it: a record, not a control (ADR 0021).
 * It is a `span`, so a tap on it is a tap on the Card and opens the Note -
 * where the bell is.
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
      role="img"
      aria-label={
        repeat ? t('reminders.chipRepeating', { when, repeat }) : t('reminders.chip', { when })
      }
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs',
        past && 'line-through opacity-60'
      )}
    >
      <Bell className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{when}</span>
      {repeat && (
        <>
          <Repeat className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{repeat}</span>
        </>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Mount it on the Card**

In `src/components/cards/NoteCard.tsx`, add the imports:

```ts
import { ReminderChip } from '@/components/reminders/ReminderChip.tsx';
import { reminderOf } from '@/lib/reminder.ts';
```

Inside the component, beside its other derived values:

```ts
  // Hidden in Trash: a Note on its way out should not look like it still has
  // an appointment. The fields stay on the row, so Restore brings the chip back.
  const reminder = note.state === 'trashed' ? undefined : reminderOf(note);
```

And in the foot row, immediately before `<TagPills ... />`:

```tsx
          {reminder && <ReminderChip reminder={reminder} />}
```

- [ ] **Step 5: Run unit tests, then the acceptance test**

Run: `pnpm test src/components/reminders src/components/cards`
Expected: PASS.

Run: `pnpm test:e2e e2e/reminder.spec.ts`
Expected: PASS, all tests, both projects (`desktop`, `mobile`; the two share tests report skipped on `desktop`).

- [ ] **Step 6: Look at it**

Run `pnpm dev`, and at both a phone width and a desktop width check, in light and dark:
- a Card with a chip **and** three labels: the foot row wraps, the rail stays right-aligned, nothing overflows the Card;
- a long Czech repeating label (`Po 4. bře 09:00` + `Měsíčně`) truncates inside the chip rather than widening the Card;
- the bell in the editor bar matches the pin's size, focus ring and pressed fill exactly;
- the popover's two native inputs are legible in dark (if the `datetime-local` icon is black-on-dark, add `dark:[color-scheme:dark]` to `FIELD` in `ReminderButton.tsx`).

Fix what is off before committing; DESIGN.md's Named Rules are binding.

- [ ] **Step 7: Commit**

```bash
git add src/components/reminders src/components/cards
git commit -m "[ADD] A Card shows its Note's Reminder as a read-only chip, muted once a one-shot has passed and hidden in Trash"
```

---

### Task 8: Docs, full gates, and the device check

**Files:**
- Modify: `CLAUDE.md` (new section after "Tags / labels")
- Modify: `PLAN.md` (one roadmap line, wherever the current milestone's extras are listed)

- [ ] **Step 1: Add the architecture section to `CLAUDE.md`**

```markdown
### Reminders (`src/lib/reminder*.ts`, `src/lib/hand-off.ts`, `src/components/reminders/`)

A Reminder is two unindexed fields on the Note, `remindAt` and `repeat` ([ADR 0021](./docs/adr/0021-reminders-are-handed-off-to-the-calendar.md)).
**The app never notifies** - no Notification permission, no service-worker code, no timers - because a web app without push cannot fire anything while closed; the alarm belongs to the user's calendar.
Setting a Reminder *is* handing it off: `NoteEditorDialog.handleReminderSet` persists the draft, builds the `.ics` (`lib/reminder-ics.ts`, hand-written - the plan of 2026-09-20 records why no package), calls `handOff`, and only then writes the fields; a dismissed share sheet writes nothing.
`remindAt` is a **local wall-clock string** (`YYYY-MM-DDTHH:mm`), the one deliberate exception to the ISO-timestamp convention, written to the file as a floating time so 09:00 stays 09:00 across a DST change.
`handOff` (share on a coarse pointer that can share files, otherwise download) is the one function whose real behaviour only exists on a device, which is why it is one function.
The `ReminderButton` sits in `NoteEditorBar` because a draft can carry one; the Card's `ReminderChip` is a record, not a control.
```

- [ ] **Step 2: Run every gate**

```bash
pnpm check && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all four pass. `pnpm test:e2e` includes `onboarding.spec.ts`; the Tour marks the app inert and spotlights the editor in step 2, so confirm it is still green with a bell in the bar.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md PLAN.md
git commit -m "[EDIT] CLAUDE.md gains the Reminders section; the roadmap records the slice"
```

- [ ] **Step 4: The device check (human, after deploy - do not mark the slice done without it)**

On a real phone, in the **installed** PWA over HTTPS, set a weekly Reminder and record what happens:

| Question | If the answer is bad |
|---|---|
| Android: does the share sheet list a calendar app, and does choosing it open an add-event screen with the title and time filled? | In `handOff`, skip sharing on Android and download; if a downloaded `.ics` also fails to open the calendar, add the Google Calendar template link as a third path (`calendar-link` is the package to look at then). |
| iOS: same, from the installed PWA and from Safari. | iOS Safari opens `.ics` natively on navigation; try `window.location.assign(URL.createObjectURL(file))` inside `handOff` for iOS. |
| Does the event fire at 09:00, or at the calendar's default offset (Google reportedly ignores `VALARM`)? | Nothing to fix in code; say so in the popover's `reminders.oneWay` copy. |
| Does a zero-length event (no `DTEND`) import cleanly? | Add `DURATION:PT15M` after `DTSTART` in `buildReminderIcs` and a test line for it. |
| Set it again with a new time: is the event replaced, or duplicated? | Expected to duplicate on Google. If it does everywhere, change the primary label from "Update in calendar" back to "Add to calendar" - do not promise an update that does not happen. |
| Does tapping the event's link open the Note in the installed PWA? | Check the manifest `scope`/`start_url`; a link-capturing fix is its own slice. |

Record the answers in ADR 0021's Consequences section, replacing the "unverified" paragraph.

---

## Self-review

- **Spec coverage (ADR 0021):** 1 never notifies - Global Constraints, no task adds any; 2 two fields, no bump, bumps `updatedAt` - Task 2 + `updateNote` in Task 6; 3 setting is handing off - Task 5 (one action), Task 6 (order of operations), Task 1 (cancelled share saves nothing); 4 one-way, UID/SEQUENCE, no CANCEL - Task 3, `reminders.oneWay` copy; 5 title + link, never Body - Task 3 tests; 6 wall-clock + floating - Tasks 2, 3; 7 placement, native inputs, read-only chip, no destination - Tasks 5-7. Consequences: `handOff` seam - Task 4; device check - Task 8 Step 4; past one-shot stays, muted - Task 7.
- **Not covered, on purpose:** the thesis repo's UC8/UC9 (`ni-dip-thesys/text/analysis/use-cases.tex`) still describe app-raised notifications and a permission prompt. That is a different repository; reword it alongside this slice.
- **Known accepted gap:** an otherwise empty draft with a Reminder is purged on close (Task 6 Step 3).
- **Type consistency:** `Reminder { remindAt, repeat? }` is the only shape passed between tasks; `onSet` returns `Promise<boolean>` in Tasks 5 and 6; `handOff` returns `'shared' | 'downloaded' | 'cancelled'` in Tasks 4 and 6; file name `reminder.ics` in Tasks 1, 3, 4.
