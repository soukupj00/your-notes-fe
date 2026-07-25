import { ConfirmDeleteButton as BaseConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton';
import type { TFunction } from '../button-types';

export interface ConfirmDeleteButtonProps {
  /** Invoked once, only when the user confirms. In every NodeView this is
   *  `() => props.deleteNode()` - editor-only, never touches Dexie. */
  onConfirm: () => void;
  /** Per-kind aria-label for the trigger, e.g. t('editor.video.delete'). */
  label: string;
  /** Resolves the shared attachments.confirmDelete.* dialog strings. */
  t: TFunction;
  /** Extra classes for the trigger button (merged over the default look). */
  triggerClassName?: string;
  /** Extra classes for the trash icon (merged over the default size). */
  iconClassName?: string;
}

/** The shared `ConfirmDeleteButton` bound to the attachment copy, so every media
 *  NodeView (image/audio/video/file/Excalidraw) asks the same question. Node
 *  removal stays editor-only - blob GC still happens at dialog close
 *  (collectOrphans). */
export function ConfirmDeleteButton({ t, ...props }: ConfirmDeleteButtonProps) {
  return (
    <BaseConfirmDeleteButton
      {...props}
      title={t('attachments.confirmDelete.title')}
      description={t('attachments.confirmDelete.description')}
      confirmLabel={t('attachments.confirmDelete.confirm')}
      cancelLabel={t('attachments.confirmDelete.cancel')}
    />
  );
}

export default ConfirmDeleteButton;
