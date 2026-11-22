import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { exportBackup } from '@/lib/export-backup.ts';

/** "Save a Backup" as one user act: `busy` while the file is built, a toast when it lands. */
export function useSaveBackup(): { busy: boolean; save: () => Promise<boolean> } {
  const store = useLocalStore();
  const { busy, run } = useAction();
  const save = () =>
    run(async () => (await exportBackup(store)) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });
  return { busy, save };
}
