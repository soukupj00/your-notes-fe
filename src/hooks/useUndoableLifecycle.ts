import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type LifecycleSnapshot, useNoteActions } from '@/hooks/data/useNoteActions.ts';

/** The lifecycle moves a person makes on a Card or an open Note, each toasting its own undo. */
export function useUndoableLifecycle() {
  const { t } = useTranslation();
  const { revertLifecycle, pinNote, unpinNote, archiveNote, trashNote, restoreToActive } =
    useNoteActions();

  return useMemo(() => {
    // One wrapper for every move, so a new one cannot ship without an undo.
    const withUndo =
      (run: (id: string) => Promise<LifecycleSnapshot | null>, message: string) =>
      async (id: string) => {
        const before = await run(id);
        if (!before) return;
        toast(message, {
          action: { label: t('notes.undo'), onClick: () => revertLifecycle(id, before) },
        });
      };

    return {
      pin: withUndo(pinNote, t('notes.pinned')),
      unpin: withUndo(unpinNote, t('notes.unpinned')),
      archive: withUndo(archiveNote, t('notes.archived')),
      trash: withUndo(trashNote, t('notes.movedToTrash')),
      restore: withUndo(restoreToActive, t('notes.restored')),
    };
  }, [t, revertLifecycle, pinNote, unpinNote, archiveNote, trashNote, restoreToActive]);
}
