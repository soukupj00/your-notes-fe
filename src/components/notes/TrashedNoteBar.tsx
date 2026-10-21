import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';

interface TrashedNoteBarProps {
  onRestore: () => void;
  onDeleteForever: () => void;
}

/** The open Note's bar in the trash, where the Note is a preview: only the way back or out. */
export function TrashedNoteBar({ onRestore, onDeleteForever }: TrashedNoteBarProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      data-slot="note-editor-bar"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-[calc(0.5rem+var(--safe-bottom))] sm:pb-0"
    >
      <p className="mr-auto text-muted-foreground text-sm">{t('notes.trashedPreview')}</p>
      <div className="-mr-2.5 ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onRestore}>
          <RotateCcw aria-hidden />
          {t('notes.restore')}
        </Button>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('notes.confirmDeleteForever.title')}
          description={t('notes.confirmDeleteForever.description')}
          confirmLabel={t('notes.confirmDeleteForever.confirm')}
          cancelLabel={t('notes.confirmDeleteForever.cancel')}
          onConfirm={onDeleteForever}
        >
          <Button variant="ghost" size="sm">
            <icons.TrashX aria-hidden />
            {t('notes.deleteForever')}
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  );
}
