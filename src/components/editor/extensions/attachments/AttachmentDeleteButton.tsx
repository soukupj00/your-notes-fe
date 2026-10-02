import { ConfirmDeleteButton as BaseConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton';
import type { TFunction } from '../button-types';

export interface AttachmentDeleteButtonProps {
  /** Runs only on confirm. Editor-only (`deleteNode()`): it never touches the database. */
  onConfirm: () => void;
  label: string;
  t: TFunction;
  /** Over a visual preview, rather than inline in a row. */
  overlay?: boolean;
}

/** Removing the node leaves the row: orphans are collected when the dialog closes
 *  (collectOrphans). */
export function AttachmentDeleteButton({
  t,
  overlay = false,
  ...props
}: AttachmentDeleteButtonProps) {
  const button = (
    <BaseConfirmDeleteButton
      {...props}
      title={t('attachments.confirmDelete.title')}
      description={t('attachments.confirmDelete.description')}
      confirmLabel={t('attachments.confirmDelete.confirm')}
      cancelLabel={t('attachments.confirmDelete.cancel')}
      triggerClassName={
        overlay
          ? 'size-9 bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:text-white'
          : undefined
      }
      iconClassName={overlay ? 'size-5' : undefined}
    />
  );

  return overlay ? <span className="absolute top-2 right-2 z-10">{button}</span> : button;
}
