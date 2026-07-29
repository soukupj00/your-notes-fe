import { Check } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import {
  BackupError,
  backupFilename,
  buildBackupZip,
  type ParsedBackup,
  parseBackupZip,
  requestSaveTarget,
  restoreBackup,
} from '@/lib/backup.ts';
import { cn } from '@/lib/utils.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/** Which long-running action is in flight; blocks both buttons while set. */
type Busy = 'export' | 'import' | null;

function errorKey(error: unknown): string {
  return error instanceof BackupError
    ? `settings.backup.error.${error.code}`
    : 'settings.backup.error.unknown';
}

/**
 * A real checkbox wrapped in its label, matching `TagPopover` - Radix renders
 * the shared `ui/checkbox` as a `<button>`, which a `<label>` cannot activate.
 */
function InlineCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          checked && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span>{label}</span>
    </label>
  );
}

/**
 * Export / import of the whole database as a zip.
 *
 * Import is replace-all, so the confirmation carries its own safety net: the
 * archive is fully validated before the dialog opens, the dialog names what is
 * about to be traded, and the "back up first" choice lives on that same screen
 * rather than ambushing the user with a second save dialog after they commit.
 *
 * Both flows ask for a destination *before* building any bytes, so a cancel at
 * the picker abandons the operation with nothing written and nothing wiped.
 */
export function BackupSection() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [backupFirst, setBackupFirst] = useState(true);

  const handleExport = async () => {
    const target = await requestSaveTarget(backupFilename());
    // Cancelled at the picker: the user knows what they did, so say nothing.
    if (!target) return;

    setBusy('export');
    try {
      await target.write(await buildBackupZip());
      // Only claim it saved when the browser actually told us where it went;
      // the anchor fallback hands the file off and never reports back.
      if (target.confirmed) toast.success(t('settings.backup.exported'));
    } catch {
      toast.error(t('settings.backup.error.unknown'));
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    setBusy('import');
    try {
      const parsed = await parseBackupZip(new Uint8Array(await file.arrayBuffer()));
      setBackupFirst(true);
      setPending(parsed);
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = async () => {
    const backup = pending;
    if (!backup) return;
    setPending(null);

    const target = backupFirst ? await requestSaveTarget(backupFilename('-before-import')) : null;
    // Backing out of the safety copy backs out of the import - restoring anyway
    // would destroy exactly the data the user just declined to lose.
    if (backupFirst && !target) {
      toast.info(t('settings.backup.importCancelled'));
      return;
    }

    setBusy('import');
    try {
      // A failed safety copy throws before restoreBackup, so the wipe never runs.
      if (target) await target.write(await buildBackupZip());
      await restoreBackup(backup);
      toast.success(t('settings.backup.imported'));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setBusy(null);
    }
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
          className="gap-1"
          disabled={busy !== null}
          onClick={() => void handleExport()}
        >
          {busy === 'export' ? <Spinner /> : <Download className="size-4" aria-hidden />}
          {busy === 'export' ? t('settings.backup.exporting') : t('settings.backup.export.action')}
        </Button>
      </SettingsRow>

      <SettingsRow
        label={t('settings.backup.import.label')}
        description={t('settings.backup.import.description')}
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === 'import' ? <Spinner /> : <Download className="size-4 rotate-180" aria-hidden />}
          {busy === 'import' ? t('settings.backup.importing') : t('settings.backup.import.action')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-label={t('settings.backup.import.label')}
          onChange={(event) => void handleFile(event)}
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
        onConfirm={() => void confirmRestore()}
        body={
          <InlineCheckbox
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
