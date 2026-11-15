import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';

export function EmptyTrashButton() {
  const { t } = useTranslation();
  const { emptyTrash } = useNoteActions();
  // Purging cascades into every trashed note's attachments, so it is not
  // instant on a full trash - say so rather than leaving a dead button.
  const [purging, setPurging] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleEmpty = async () => {
    setPurging(true);
    try {
      const count = await emptyTrash();
      // Nothing to report (and nothing to undo) when the trash was already empty.
      if (count > 0) toast(t('notes.trashEmptied', { count }));
    } finally {
      setPurging(false);
    }
  };

  return (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={t('notes.confirmEmptyTrash.title')}
      description={t('notes.confirmEmptyTrash.description')}
      confirmLabel={t('notes.confirmEmptyTrash.confirm')}
      cancelLabel={t('notes.confirmEmptyTrash.cancel')}
      onConfirm={() => void handleEmpty()}
    >
      <Button variant="ghost" size="sm" className="gap-1" disabled={purging}>
        {purging && <Spinner />}
        {purging ? t('notes.emptyingTrash') : t('notes.emptyTrash')}
      </Button>
    </ConfirmDialog>
  );
}
