import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalStore } from '@/data/LocalStore.ts';
import type { SaveTarget } from '@/lib/backup.ts';
import { exportBackup } from './export-backup.ts';

const backup = vi.hoisted(() => ({
  buildBackupZip: vi.fn(),
  requestSaveTarget: vi.fn(),
}));

vi.mock('@/lib/backup.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/backup.ts')>()),
  ...backup,
}));

const store = {} as LocalStore;
const zip = new Blob(['zip']);

function target(confirmed: boolean): SaveTarget & { write: ReturnType<typeof vi.fn> } {
  return { confirmed, write: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  backup.buildBackupZip.mockResolvedValue(zip);
});

describe('exportBackup', () => {
  it('asks where the file goes before building it, and names it with the suffix', async () => {
    backup.requestSaveTarget.mockResolvedValue(target(true));

    await exportBackup(store, '-before-import');

    expect(backup.requestSaveTarget.mock.invocationCallOrder[0]).toBeLessThan(
      backup.buildBackupZip.mock.invocationCallOrder[0]
    );
    expect(backup.requestSaveTarget.mock.calls[0][0]).toMatch(
      /^ruflo-backup-.*-before-import\.zip$/
    );
  });

  it.each([
    ['a chosen destination', target(true), 'saved'],
    ['the anchor fallback', target(false), 'unconfirmed'],
  ])('writes the zip to %s and says so', async (_name, chosen, outcome) => {
    backup.requestSaveTarget.mockResolvedValue(chosen);

    expect(await exportBackup(store)).toBe(outcome);
    expect(chosen.write).toHaveBeenCalledWith(zip);
  });

  it('builds nothing when the picker was cancelled', async () => {
    backup.requestSaveTarget.mockResolvedValue(null);

    expect(await exportBackup(store)).toBe('cancelled');
    expect(backup.buildBackupZip).not.toHaveBeenCalled();
  });

  it('lets a failed build through, so a caller restoring on top of it stops', async () => {
    const chosen = target(true);
    backup.requestSaveTarget.mockResolvedValue(chosen);
    backup.buildBackupZip.mockRejectedValue(new Error('out of memory'));

    await expect(exportBackup(store)).rejects.toThrow('out of memory');
    expect(chosen.write).not.toHaveBeenCalled();
  });
});
