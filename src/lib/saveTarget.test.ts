import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSaveTarget } from '@/lib/backup.ts';

// jsdom (not the node environment the rest of backup.test.ts uses): this is the
// one part of the backup layer that talks to the browser.

const picker = vi.fn();

/** Captures the anchor the fallback path builds, without letting it navigate. */
function stubAnchorDownload() {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
  return click;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'showSaveFilePicker', {
    configurable: true,
    writable: true,
    value: picker,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
});

describe('requestSaveTarget', () => {
  it('writes through the handle the user chose, and reports it confirmed', async () => {
    const writable = { write: vi.fn(), close: vi.fn() };
    picker.mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });

    const target = await requestSaveTarget('ruflo-backup.zip');
    const blob = new Blob(['payload']);
    await target?.write(blob);

    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'ruflo-backup.zip' })
    );
    expect(target?.confirmed).toBe(true);
    expect(writable.write).toHaveBeenCalledWith(blob);
    // Without the close the bytes may never reach disk.
    expect(writable.close).toHaveBeenCalledTimes(1);
  });

  it('returns null when the user cancels the picker', async () => {
    picker.mockRejectedValue(new DOMException('cancelled', 'AbortError'));

    expect(await requestSaveTarget('ruflo-backup.zip')).toBeNull();
  });

  it('falls back to a download when the API is missing, and admits it is unconfirmed', async () => {
    Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
    const click = stubAnchorDownload();

    const target = await requestSaveTarget('ruflo-backup.zip');
    await target?.write(new Blob(['payload']));

    expect(target?.confirmed).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('falls back rather than failing when the picker refuses for another reason', async () => {
    picker.mockRejectedValue(new DOMException('blocked', 'SecurityError'));
    const click = stubAnchorDownload();

    const target = await requestSaveTarget('ruflo-backup.zip');
    await target?.write(new Blob(['payload']));

    expect(target?.confirmed).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
