import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { icons } from '@/components/icons';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { AttachmentNotDownloaded } from '../attachments/AttachmentNotDownloaded';
import { AttachmentUnavailable } from '../attachments/AttachmentUnavailable';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** A file is not inline-renderable, so it gets an icon, its name and an open/download link. */
export function FileNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const FileIcon = icons.FileText;
  const DownloadIcon = icons.Download;
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.file.delete')}
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
        fallbackName={deps.t('editor.file.fallbackName')}
        deleteButton={deleteButton}
      />
    );
  }

  if (state.status === 'missing') {
    return (
      <AttachmentUnavailable
        label={deps.t('editor.file.unavailable')}
        deleteButton={deleteButton}
      />
    );
  }

  const name = (state.status === 'ready' && state.name) || deps.t('editor.file.fallbackName');

  return (
    <NodeViewWrapper as="div" className="relative my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 py-2 pr-12 pl-3">
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
      </div>
      {deleteButton}
    </NodeViewWrapper>
  );
}

export default FileNodeView;
