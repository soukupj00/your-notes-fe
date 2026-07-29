import { ConfirmDeleteButton as BaseConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton';
import type { TFunction } from '../button-types';

export interface AttachmentDeleteButtonProps {
  /** Invoked once, only when the user confirms. In every NodeView this is
   *  `() => props.deleteNode()` - editor-only, never touches Dexie. */
  onConfirm: () => void;
  /** Per-kind aria-label for the trigger, e.g. t('editor.video.delete'). */
  label: string;
  /** Resolves the shared attachments.confirmDelete.* dialog strings. */
  t: TFunction;
  /** Positions a prominent delete control over a visual attachment preview. */
  overlay?: boolean;
}

/** Binds the generic confirmation control to attachment copy and presentation.
 *  Node removal stays editor-only - blob GC still happens at dialog close
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
