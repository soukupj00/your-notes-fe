import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for videoAttachment: a native <video controls> at the
 *  resolved object URL. Unlike audio, video needs no custom player skin -
 *  native controls give scrubbing, fullscreen, volume, and mute for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.video.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.video.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-start gap-3">
        {state.status === 'ready' && (
          <video
            src={state.url}
            controls
            playsInline
            preload="metadata"
            className="max-w-full rounded"
          >
            <track kind="captions" />
          </video>
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default VideoNodeView;
