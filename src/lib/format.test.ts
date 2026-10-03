import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatElapsed,
  formatFileType,
  MEDIUM_DATE,
  MEDIUM_DATE_TIME,
} from './format.ts';

describe('formatDuration', () => {
  it('pads seconds and drops the hour when there is none', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(84)).toBe('1:24');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('grows an hour field only once it is needed', () => {
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('returns null for a row whose duration was never computed', () => {
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });
});

describe('formatElapsed', () => {
  it('formats seconds as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(14)).toBe('0:14');
    expect(formatElapsed(75)).toBe('1:15');
  });

  it('grows an hour field like a duration does, so both surfaces read alike', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });

  it('floors rather than rounds, so a counter never runs ahead of the clock', () => {
    expect(formatElapsed(0.9)).toBe('0:00');
    expect(formatElapsed(59.6)).toBe('0:59');
  });

  it('shows zero for an unknown time, because a live counter must show something', () => {
    expect(formatElapsed(Number.NaN)).toBe('0:00');
    expect(formatElapsed(-1)).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it.each([
    [0, 'en', '0 B'],
    [999, 'en', '999 B'],
    [1000, 'en', '1.0 kB'],
    [1536, 'cs', '1,5 kB'],
    [248_000, 'en', '248 kB'],
    [3_400_000, 'en', '3.4 MB'],
    [3_400_000, 'cs', '3,4 MB'],
    [999_999, 'en', '1000 kB'],
    [1_500_000_000, 'cs', '1,5 GB'],
  ])('%d bytes in %s is %s', (bytes, locale, expected) => {
    expect(formatBytes(bytes, locale)).toBe(expected);
  });

  it('returns null for an unknown size', () => {
    expect(formatBytes(undefined, 'en')).toBeNull();
  });
});

describe('formatDate', () => {
  // A fixed instant at noon UTC, read in UTC: the zone of the machine running this cannot move
  // the date. Pieces, not whole strings: ICU builds differ in the spaces around AM/PM.
  const AT = '2030-03-04T12:00:00.000Z';

  it.each([
    ['en', 'MEDIUM_DATE', MEDIUM_DATE, /^Mar 4, 2030$/],
    ['cs', 'MEDIUM_DATE', MEDIUM_DATE, /^4\. 3\. 2030$/],
    ['en', 'MEDIUM_DATE_TIME', MEDIUM_DATE_TIME, /^Mar 4, 2030, 12:00/],
    ['cs', 'MEDIUM_DATE_TIME', MEDIUM_DATE_TIME, /^4\. 3\. 2030 12:00/],
  ])('writes the date in %s with %s', (locale, _preset, options, expected) => {
    expect(formatDate(AT, locale, { ...options, timeZone: 'UTC' })).toMatch(expected);
  });

  it('reads a zone-less wall-clock string as local time, the way a Reminder is stored', () => {
    expect(formatDate('2030-03-04T09:00', 'en', { hour: 'numeric', minute: '2-digit' })).toMatch(
      /^9:00/
    );
  });
});

describe('formatFileType', () => {
  it('prefers the extension', () => {
    expect(formatFileType('smlouva-2026.pdf', 'application/pdf')).toBe('PDF');
  });

  it('falls back to the mime subtype when there is no usable extension', () => {
    expect(formatFileType('archive', 'application/zip')).toBe('ZIP');
    expect(formatFileType('name.superlongext', 'application/zip')).toBe('ZIP');
  });

  it('gives up rather than printing something meaningless', () => {
    expect(formatFileType(undefined, undefined)).toBeNull();
  });
});
