import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { LabeledCheckbox } from '@/components/ui/LabeledCheckbox.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useAction } from '@/hooks/useAction.ts';
import { BackupError, type ParsedBackup, parseBackupZip, restoreBackup } from '@/lib/backup.ts';
import { exportBackup } from '@/lib/export-backup.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

function errorKey(error: unknown): string {
  return error instanceof BackupError
    ? `settings.backup.error.${error.code}`
    : 'settings.backup.error.unknown';
}

/**
 * Import is replace-all, so the archive is validated before the dialog opens and "back up
 * first" lives in that dialog. Both flows pick a destination first: CLAUDE.md (Backup).
 */
export function BackupSection() {
  const { t } = useTranslation();
  const store = useLocalStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [backupFirst, setBackupFirst] = useState(true);

  const exporting = useAction();
  const importing = useAction();
  const busy = exporting.busy || importing.busy;

  const handleExport = () =>
    exporting.run(async () => (await exportBackup(store)) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;
    void importing.run(
      async () => {
        const parsed = await parseBackupZip(new Uint8Array(await file.arrayBuffer()));
        setBackupFirst(true);
        setPending(parsed);
      },
      { failure: errorKey }
    );
  };

  const confirmRestore = () => {
    const backup = pending;
    if (!backup) return;
    setPending(null);
    void importing.run(
      async () => {
        // Backing out of the safety copy backs out of the import: restoring anyway would destroy
        // exactly the data the user just declined to lose. A failed copy throws before the wipe.
        if (backupFirst && (await exportBackup(store, '-before-import')) === 'cancelled') {
          toast.info(t('settings.backup.importCancelled'));
          return false;
        }
        await restoreBackup(store, backup);
      },
      { success: 'settings.backup.imported', failure: errorKey }
    );
  };

  const Download = icons.Download;
  const counts = pending && {
    notes: pending.manifest.notes.length,
    tags: pending.manifest.tags.length,
    attachments: pending.manifest.attachments.length,
  };

  return (
    <SettingsSection title={t('settings.backup.title')}>
      <SettingsRow
        label={t('settings.backup.export.label')}
        description={t('settings.backup.export.description')}
      >
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1"
          disabled={busy}
          onClick={() => void handleExport()}
        >
          {exporting.busy ? <Spinner /> : <Download className="size-4" aria-hidden />}
          {exporting.busy ? t('settings.backup.exporting') : t('settings.backup.export.action')}
        </Button>
      </SettingsRow>

      <SettingsRow
        label={t('settings.backup.import.label')}
        description={t('settings.backup.import.description')}
      >
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {importing.busy ? <Spinner /> : <Download className="size-4 rotate-180" aria-hidden />}
          {importing.busy ? t('settings.backup.importing') : t('settings.backup.import.action')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-label={t('settings.backup.import.label')}
          onChange={handleFile}
        />
      </SettingsRow>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t('settings.backup.confirmImport.title')}
        description={counts ? t('settings.backup.confirmImport.description', counts) : ''}
        confirmLabel={t('settings.backup.confirmImport.confirm')}
        cancelLabel={t('settings.backup.confirmImport.cancel')}
        onConfirm={confirmRestore}
        body={
          <LabeledCheckbox
            label={t('settings.backup.confirmImport.backupFirst')}
            checked={backupFirst}
            onToggle={() => setBackupFirst((value) => !value)}
          />
        }
      />
    </SettingsSection>
  );
}

export default BackupSection;
