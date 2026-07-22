import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for imageAttachment. Object-URL lifecycle lives in the
 *  shared useAttachmentObjectUrl hook (shared with audio). */
export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
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
      {state.status === 'missing' && (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          {deps.t('editor.image.unavailable')}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
