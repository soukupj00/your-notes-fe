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
