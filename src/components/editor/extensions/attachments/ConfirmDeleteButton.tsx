import { useState } from 'react';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { TFunction } from '../button-types';

export interface ConfirmDeleteButtonProps {
  /** Invoked once, only when the user confirms. In every NodeView this is
   *  `() => props.deleteNode()` - editor-only, never touches Dexie. */
  onConfirm: () => void;
  /** Per-kind aria-label for the trigger, e.g. t('editor.video.delete'). */
  label: string;
  /** Resolves the shared attachments.confirmDelete.* dialog strings. */
  t: TFunction;
}

/** Shared confirm-before-delete control for media NodeViews (image/audio/video,
 *  and later file/Excalidraw). Renders the Trash2 icon-button trigger and a
 *  confirm dialog; calls onConfirm only on confirm. Node removal stays
 *  editor-only - blob GC still happens at dialog close (collectOrphans). */
export function ConfirmDeleteButton({ onConfirm, label, t }: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const Trash = icons.Trash2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('attachments.confirmDelete.title')}</DialogTitle>
          <DialogDescription>{t('attachments.confirmDelete.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('attachments.confirmDelete.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {t('attachments.confirmDelete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteButton;
