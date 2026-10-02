import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { AttachmentNotDownloaded } from '../attachments/AttachmentNotDownloaded';
import { AttachmentUnavailable } from '../attachments/AttachmentUnavailable';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.image.delete')}
      t={deps.t}
      overlay
    />
  ) : null;

  if (state.status === 'remote') {
    return (
      <AttachmentNotDownloaded
        attachment={state.attachment}
        thumbnailUrl={state.thumbnailUrl}
        deps={deps}
        fallbackName={deps.t('editor.image.fallbackAlt')}
        deleteButton={deleteButton}
      />
    );
  }

  if (state.status === 'missing') {
    return (
      <AttachmentUnavailable
        label={deps.t('editor.image.unavailable')}
        deleteButton={deleteButton}
      />
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="not-prose relative my-2 inline-block max-w-full"
      data-drag-handle
    >
      {state.status === 'ready' && (
        <img
          src={state.url}
          alt={state.name ?? deps.t('editor.image.fallbackAlt')}
          width={state.attachment.width}
          height={state.attachment.height}
          className="block h-auto max-w-full rounded-md"
        />
      )}
      {state.status === 'loading' && (
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {deleteButton}
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
