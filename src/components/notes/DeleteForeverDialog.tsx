import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';

interface DeleteForeverDialogProps {
  noteId: string;
  /** Runs once the Note is gone, e.g. to close its preview. */
  onDeleted?: () => void;
  /** The trigger. */
  children: ReactElement;
}

/** A Purge is the one move with no undo, so it asks first, in the same words on the Card and the
 *  preview. */
export function DeleteForeverDialog({ noteId, onDeleted, children }: DeleteForeverDialogProps) {
  const { t } = useTranslation();
  const { purgeNote } = useNoteActions();
  const [confirming, setConfirming] = useState(false);

  async function deleteForever() {
    await purgeNote(noteId);
    toast(t('notes.deletedForever'));
    onDeleted?.();
  }

  return (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={t('notes.confirmDeleteForever.title')}
      description={t('notes.confirmDeleteForever.description')}
      confirmLabel={t('notes.confirmDeleteForever.confirm')}
      cancelLabel={t('notes.confirmDeleteForever.cancel')}
      onConfirm={() => void deleteForever()}
    >
      {children}
    </ConfirmDialog>
  );
}
