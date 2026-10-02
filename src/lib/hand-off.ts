import { downloadBlob } from '@/lib/backup.ts';

export type HandOffResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Only a device can verify this (ADR 0021), so it is isolated to one file; a Google Calendar
 * template link is the known fallback. `cancelled` is a result, not an error: the caller must not
 * record a Reminder the calendar was never given.
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
