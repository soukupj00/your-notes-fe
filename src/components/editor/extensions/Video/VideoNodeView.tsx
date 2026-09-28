import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { AttachmentNotDownloaded } from '../attachments/AttachmentNotDownloaded';
import { AttachmentUnavailable } from '../attachments/AttachmentUnavailable';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for videoAttachment: a native <video controls> at the
 *  resolved object URL. Unlike audio, video needs no custom player skin -
 *  native controls give scrubbing, fullscreen, volume, and mute for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  // Corner overlay, matching Excalidraw's delete placement (Task 3): a
  // semi-opaque pill sits atop the content surface instead of taking flex
  // space next to it, so it stays legible over any video frame.
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
