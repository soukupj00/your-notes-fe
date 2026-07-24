import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for imageAttachment. Object-URL lifecycle lives in the
 *  shared useAttachmentObjectUrl hook; delete is guarded by the shared
 *  ConfirmDeleteButton (editor-only, same as audio/video). */
export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.image.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.image.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-start gap-3">
        {state.status === 'ready' && (
          <img
            src={state.url}
            alt={state.name ?? deps.t('editor.image.fallbackAlt')}
            className="h-auto max-w-full rounded-md"
          />
        )}
        {state.status === 'loading' && (
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
