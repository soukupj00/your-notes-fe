import type { LocalStore } from '@/data/LocalStore.ts';
import { backupFilename, buildBackupZip, requestSaveTarget } from './backup.ts';

export type ExportOutcome = 'cancelled' | 'saved' | 'unconfirmed';

/**
 * The one export flow: destination first (the picker needs the click's user activation), then
 * the zip, then the write. `unconfirmed` is the anchor fallback, where nobody can say the file
 * landed. A failed build or write throws, so a caller restoring on top of it stops before the wipe.
 */
export async function exportBackup(store: LocalStore, suffix = ''): Promise<ExportOutcome> {
  const target = await requestSaveTarget(backupFilename(suffix));
  if (!target) return 'cancelled';
  await target.write(await buildBackupZip(store));
  return target.confirmed ? 'saved' : 'unconfirmed';
}
