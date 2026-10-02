import { useState } from 'react';
import { icons } from '@/components/icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils.ts';

export interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  /** Accessible label for the trash trigger, e.g. "Delete label Work". */
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  triggerClassName?: string;
  iconClassName?: string;
}

/**
 * A trash icon-button that always asks first. Callers supply their own copy, so
 * the same control guards an attachment, a label, or anything else.
 */
export function ConfirmDeleteButton({
  onConfirm,
  label,
  title,
  description,
  confirmLabel,
  cancelLabel,
  triggerClassName,
  iconClassName,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const Trash = icons.Trash2;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          triggerClassName
        )}
      >
        <Trash className={cn('size-4', iconClassName)} />
      </button>
    </ConfirmDialog>
  );
}

export default ConfirmDeleteButton;
