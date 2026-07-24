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

  // Corner overlay, matching Excalidraw's delete placement (Task 3): a
  // semi-opaque pill sits atop the content surface instead of taking flex
  // space next to it, so it stays legible over any image.
  const deleteButton = canDelete ? (
    <span className="absolute top-2 right-2 z-10">
      <ConfirmDeleteButton
        onConfirm={() => props.deleteNode()}
        label={deps.t('editor.image.delete')}
        t={deps.t}
        triggerClassName="size-9 bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:text-white"
        iconClassName="size-5"
      />
    </span>
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="relative my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.image.unavailable')}</span>
        </div>
        {deleteButton}
      </NodeViewWrapper>
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
