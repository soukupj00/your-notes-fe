/**
 * A clip length as `m:ss`, or `h:mm:ss` once it runs past an hour.
 * Returns null for a row that never had its duration computed, so callers can
 * omit the badge rather than print a placeholder.
 */
export function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
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
