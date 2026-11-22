import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { importBackup, type ParsedBackup } from '@/lib/backup.ts';
import { exportBackup } from '@/lib/export-backup.ts';

export function useBackup() {
  const store = useLocalStore();
  return {
    exportBackup: (suffix?: string) => exportBackup(store, suffix),
    importBackup: (backup: ParsedBackup) => importBackup(store, backup),
  };
}

/** "Save a Backup" as one user act: `busy` while the file is built, a toast when it lands. */
export function useSaveBackup(): { busy: boolean; save: () => Promise<boolean> } {
  const backup = useBackup();
  const { busy, run } = useAction();
  const save = () =>
    run(async () => (await backup.exportBackup()) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });
  return { busy, save };
}
