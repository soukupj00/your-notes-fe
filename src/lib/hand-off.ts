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
