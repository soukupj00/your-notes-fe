/** Whole seconds as `m:ss`, or `h:mm:ss` once past an hour. */
function clock(wholeSeconds: number): string {
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Rounded, because a badge states a finished quantity: 59.6s of audio is a minute long. `null`
 * when the duration was never computed, so callers omit the badge.
 */
export function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  return clock(Math.round(seconds));
}

/**
 * A running playhead or timer, floored unlike `formatDuration`: a rounding counter reads `0:01`
 * before a second has passed. Unknown time is `0:00`, as a live counter must show something.
 */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return clock(Math.floor(seconds));
}

// Decimal units (kB, not KiB): the number next to a filename is read against
// what the OS file dialog said, and every desktop file manager uses decimal.
const UNITS = ['B', 'kB', 'MB', 'GB'] as const;

/**
 * A byte count at the largest unit whose value is under 1000 before rounding, the number written as
 * `locale` writes numbers (`3,4 MB` for a Czech reader); the unit tokens are the same in every language.
 */
export function formatBytes(bytes: number | undefined, locale: string): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  // Whole bytes are never fractional; above that one decimal is enough to tell
  // 1.2 MB from 1.9 MB without implying precision we do not have.
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
  return `${number} ${UNITS[unit]}`;
}

/** `Mar 4, 2030` in en, `4. 3. 2030` in cs. */
export const MEDIUM_DATE: Readonly<Intl.DateTimeFormatOptions> = { dateStyle: 'medium' };
/** The date and the time of day: `Mar 4, 2030, 9:00 AM` in en, `4. 3. 2030 9:00` in cs. */
export const MEDIUM_DATE_TIME: Readonly<Intl.DateTimeFormatOptions> = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

/**
 * A date in the app's language, never the browser's: the two differ as soon as Settings switches
 * language. Built per call rather than kept as a module constant, so a switch shows at once.
 * `iso` may be an instant (`…Z`) or a Reminder's zone-less wall-clock string; `Date` reads both.
 */
export function formatDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
}

/**
 * The uppercase extension of a filename, used as the file chip's type label.
 * Falls back to the mime subtype so an extensionless upload still says what it
 * is, and gives up rather than printing something meaningless.
 */
export function formatFileType(name: string | undefined, mime: string | undefined): string | null {
  const ext = name?.includes('.') ? name.split('.').pop() : undefined;
  if (ext && ext.length <= 5) return ext.toUpperCase();
  const subtype = mime?.split('/')[1];
  return subtype ? subtype.toUpperCase() : null;
}
