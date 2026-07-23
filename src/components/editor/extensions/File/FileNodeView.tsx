import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { icons } from '@/components/icons';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for fileAttachment. Files are not inline-renderable, so
 *  this shows a generic file icon, the original filename, and an open/download
 *  link (opens the Blob object URL in a new tab; non-viewable types download).
 *  Object-URL lifecycle handled by the shared hook. Delete is guarded by the
 *  shared ConfirmDeleteButton (editor-only, same as audio/video/image). */
export function FileNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const FileIcon = icons.FileText;
  const DownloadIcon = icons.Download;
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.file.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.file.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  const name = (state.status === 'ready' && state.name) || deps.t('editor.file.fallbackName');

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <FileIcon className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{name}</span>
        {state.status === 'ready' && (
          <a
            href={state.url}
            download={state.name ?? ''}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={deps.t('editor.file.open')}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <DownloadIcon className="size-4" />
          </a>
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default FileNodeView;
