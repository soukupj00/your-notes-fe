import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupError, type ParsedBackup, type SaveTarget } from '@/lib/backup.ts';
import { renderWithStore as render, testStore } from '@/test/store.tsx';
import { BackupSection } from './BackupSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// The zip/Dexie work is covered in lib/backup.test.ts (under Node, where Blobs
// survive a round-trip); here we only care about the flow the component drives.
const backup = vi.hoisted(() => ({
  buildBackupZip: vi.fn(),
  parseBackupZip: vi.fn(),
  restoreBackup: vi.fn(),
  requestSaveTarget: vi.fn(),
}));

vi.mock('@/lib/backup.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/backup.ts')>()),
  ...backup,
}));

const parsed = {
  manifest: { notes: [{}, {}], tags: [{}], attachments: [] },
} as unknown as ParsedBackup;

/** A destination the browser confirmed, i.e. a completed write really happened. */
const saveTarget = (): SaveTarget & { write: ReturnType<typeof vi.fn> } => ({
  confirmed: true,
  write: vi.fn().mockResolvedValue(undefined),
});

const pickFile = async () => {
  const input = screen.getByLabelText('settings.backup.import.label');
  await userEvent.upload(input, new File(['zip bytes'], 'backup.zip', { type: 'application/zip' }));
};

const confirmImport = async () =>
  userEvent.click(
    await screen.findByRole('button', { name: 'settings.backup.confirmImport.confirm' })
  );

beforeEach(() => {
  vi.clearAllMocks();
  backup.buildBackupZip.mockResolvedValue(new Blob(['zip']));
  backup.parseBackupZip.mockResolvedValue(parsed);
  backup.restoreBackup.mockResolvedValue(undefined);
  backup.requestSaveTarget.mockResolvedValue(saveTarget());
});

describe('export', () => {
  it('asks where to save before building the zip', async () => {
    render(<BackupSection />);

    await userEvent.click(screen.getByRole('button', { name: 'settings.backup.export.action' }));

    await waitFor(() => expect(backup.buildBackupZip).toHaveBeenCalled());
    // Building first would spend the click's user activation on the picker.
    expect(backup.requestSaveTarget.mock.invocationCallOrder[0]).toBeLessThan(
      backup.buildBackupZip.mock.invocationCallOrder[0]
    );
    expect(backup.requestSaveTarget.mock.calls[0][0]).toMatch(/^ruflo-backup-.*\.zip$/);
  });

  it('only claims success once the bytes are actually written', async () => {
    const target = saveTarget();
    backup.requestSaveTarget.mockResolvedValue(target);
    render(<BackupSection />);

    await userEvent.click(screen.getByRole('button', { name: 'settings.backup.export.action' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('settings.backup.exported'));
    expect(target.write).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the browser cannot confirm the file landed', async () => {
    // The anchor fallback: the download is handed off, the outcome is unknowable.
    backup.requestSaveTarget.mockResolvedValue({ confirmed: false, write: vi.fn() });
    render(<BackupSection />);

    await userEvent.click(screen.getByRole('button', { name: 'settings.backup.export.action' }));

    await waitFor(() => expect(backup.buildBackupZip).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('builds nothing when the save dialog is cancelled', async () => {
    backup.requestSaveTarget.mockResolvedValue(null);
    render(<BackupSection />);

    await userEvent.click(screen.getByRole('button', { name: 'settings.backup.export.action' }));

    await waitFor(() => expect(backup.requestSaveTarget).toHaveBeenCalled());
    expect(backup.buildBackupZip).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports a failure instead of claiming success', async () => {
    backup.buildBackupZip.mockRejectedValue(new Error('quota'));
    render(<BackupSection />);

    await userEvent.click(screen.getByRole('button', { name: 'settings.backup.export.action' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.backup.error.unknown'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('import', () => {
  it('asks for confirmation before restoring anything', async () => {
    render(<BackupSection />);

    await pickFile();

    expect(await screen.findByText('settings.backup.confirmImport.title')).toBeInTheDocument();
    expect(backup.restoreBackup).not.toHaveBeenCalled();
    expect(backup.requestSaveTarget).not.toHaveBeenCalled();
  });

  it('saves the current data before restoring, opted in by default', async () => {
    const target = saveTarget();
    backup.requestSaveTarget.mockResolvedValue(target);
    render(<BackupSection />);
    await pickFile();

    await confirmImport();

    await waitFor(() => expect(backup.restoreBackup).toHaveBeenCalledWith(testStore, parsed));
    expect(backup.requestSaveTarget.mock.calls[0][0]).toContain('-before-import');
    expect(target.write.mock.invocationCallOrder[0]).toBeLessThan(
      backup.restoreBackup.mock.invocationCallOrder[0]
    );
    expect(toast.success).toHaveBeenCalledWith('settings.backup.imported');
  });

  it('abandons the import when the safety copy is cancelled', async () => {
    // Restoring here would destroy exactly the data the user declined to lose.
    backup.requestSaveTarget.mockResolvedValue(null);
    render(<BackupSection />);
    await pickFile();

    await confirmImport();

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('settings.backup.importCancelled'));
    expect(backup.restoreBackup).not.toHaveBeenCalled();
  });

  it('never restores when writing the safety copy fails', async () => {
    backup.requestSaveTarget.mockResolvedValue({
      confirmed: true,
      write: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    render(<BackupSection />);
    await pickFile();

    await confirmImport();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.backup.error.unknown'));
    expect(backup.restoreBackup).not.toHaveBeenCalled();
  });

  it('skips the safety copy when the user unticks it', async () => {
    render(<BackupSection />);
    await pickFile();

    await userEvent.click(await screen.findByText('settings.backup.confirmImport.backupFirst'));
    await confirmImport();

    await waitFor(() => expect(backup.restoreBackup).toHaveBeenCalledWith(testStore, parsed));
    expect(backup.requestSaveTarget).not.toHaveBeenCalled();
  });

  it('restores nothing when the confirmation is cancelled', async () => {
    render(<BackupSection />);
    await pickFile();

    await userEvent.click(
      await screen.findByRole('button', { name: 'settings.backup.confirmImport.cancel' })
    );

    await waitFor(() =>
      expect(screen.queryByText('settings.backup.confirmImport.title')).not.toBeInTheDocument()
    );
    expect(backup.restoreBackup).not.toHaveBeenCalled();
    expect(backup.requestSaveTarget).not.toHaveBeenCalled();
  });

  it('rejects an invalid backup with its own message and never opens the dialog', async () => {
    backup.parseBackupZip.mockRejectedValue(new BackupError('unsupported-version'));
    render(<BackupSection />);

    await pickFile();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('settings.backup.error.unsupported-version')
    );
    expect(screen.queryByText('settings.backup.confirmImport.title')).not.toBeInTheDocument();
    expect(backup.restoreBackup).not.toHaveBeenCalled();
  });
});
