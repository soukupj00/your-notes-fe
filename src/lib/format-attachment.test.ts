import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatElapsed, formatFileType } from './format-attachment.ts';

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
  it('keeps whole bytes whole and steps up at a thousand', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1000)).toBe('1.0 kB');
  });

  it('drops the decimal once the number is wide enough to carry itself', () => {
    expect(formatBytes(248_000)).toBe('248 kB');
    expect(formatBytes(3_400_000)).toBe('3.4 MB');
  });

  it('returns null for an unknown size', () => {
    expect(formatBytes(undefined)).toBeNull();
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
