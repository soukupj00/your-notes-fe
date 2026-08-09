/** Whole seconds as `m:ss`, or `h:mm:ss` once past an hour. */
function clock(wholeSeconds: number): string {
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * A clip's total length.
 *
 * Rounded, because a badge states a finished quantity and 59.6s of audio is a
 * minute long. Returns null for a row that never had its duration computed, so
 * callers can omit the badge rather than print a placeholder.
 */
export function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  return clock(Math.round(seconds));
}

/**
 * A running playhead or recording timer.
 *
 * Floored rather than rounded, which is the whole reason this is not
 * `formatDuration`: a counter that rounds reads `0:01` before the first second
 * has passed and reaches its own total a half-second early. Unknown time is
 * `0:00`, because a live counter has to show something.
 */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return clock(Math.floor(seconds));
}

// Decimal units (kB, not KiB): the number next to a filename is read against
// what the OS file dialog said, and every desktop file manager uses decimal.
const UNITS = ['B', 'kB', 'MB', 'GB'] as const;

/** A byte count at the largest unit that keeps it under four digits. */
export function formatBytes(bytes: number | undefined): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  // Whole bytes are never fractional; above that one decimal is enough to tell
  // 1.2 MB from 1.9 MB without implying precision we do not have.
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value < 10 ? 1 : 0);
  return `${rounded} ${UNITS[unit]}`;
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
