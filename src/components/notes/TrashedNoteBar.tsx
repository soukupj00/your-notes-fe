import { Archive, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { icons } from '@/components/icons';
import { DeleteForeverDialog } from '@/components/notes/DeleteForeverDialog.tsx';
import { Button } from '@/components/ui/button.tsx';

interface TrashedNoteBarProps {
  noteId: string;
  onRestore: () => void;
  onArchive: () => void;
  onDeleted: () => void;
}

/** The open Note's bar in the trash, where the Note is a preview: only the ways back or out. */
export function TrashedNoteBar({ noteId, onRestore, onArchive, onDeleted }: TrashedNoteBarProps) {
  const { t } = useTranslation();

  return (
    <div
      data-slot="note-editor-bar"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-[calc(0.5rem+var(--safe-bottom))] sm:pb-0"
    >
      <p className="mr-auto text-muted-foreground text-sm">{t('notes.trashedPreview')}</p>
      <div className="-mr-2.5 ml-auto flex flex-wrap items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onRestore}>
          <RotateCcw aria-hidden />
          {t('notes.restore')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onArchive}>
          <Archive aria-hidden />
          {t('notes.archive')}
        </Button>
        <DeleteForeverDialog noteId={noteId} onDeleted={onDeleted}>
          <Button variant="ghost" size="sm">
            <icons.TrashX aria-hidden />
            {t('notes.deleteForever')}
          </Button>
        </DeleteForeverDialog>
      </div>
    </div>
  );
}
