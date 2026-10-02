import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { AttachmentNotDownloaded } from '../attachments/AttachmentNotDownloaded';
import { AttachmentUnavailable } from '../attachments/AttachmentUnavailable';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Native controls, unlike audio: they give scrubbing, fullscreen and volume for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.video.delete')}
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
        fallbackName={deps.t('editor.video.label')}
        deleteButton={deleteButton}
      />
    );
  }

  if (state.status === 'missing') {
    return (
      <AttachmentUnavailable
        label={deps.t('editor.video.unavailable')}
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
        <video
          src={state.url}
          width={state.attachment.width}
          height={state.attachment.height}
          controls
          playsInline
          preload="metadata"
          className="block h-auto max-w-full rounded"
        >
          <track kind="captions" />
        </video>
      )}
      {deleteButton}
    </NodeViewWrapper>
  );
}

export default VideoNodeView;
