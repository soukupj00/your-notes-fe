import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { icons } from '@/components/icons';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for videoAttachment: a native <video controls> at the
 *  resolved object URL. Unlike audio, video needs no custom player skin -
 *  native controls give scrubbing, fullscreen, volume, and mute for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const Trash = icons.Trash2;
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <button
      type="button"
      onClick={() => props.deleteNode()}
      aria-label={deps.t('editor.video.delete')}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash className="size-4" />
    </button>
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
