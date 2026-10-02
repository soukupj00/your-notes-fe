import type { ReactNodeViewProps } from '@tiptap/react';
import { icons } from '@/components/icons';
import { type AttachmentNodeCopy, AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY: AttachmentNodeCopy = {
  delete: 'editor.file.delete',
  unavailable: 'editor.file.unavailable',
  fallbackName: 'editor.file.fallbackName',
};

/** A file is not inline-renderable, so it gets an icon, its name and an open/download link. */
export function FileNodeView(props: ReactNodeViewProps) {
  const FileIcon = icons.FileText;
  const DownloadIcon = icons.Download;
  return (
    <AttachmentNodeView
      props={props}
      copy={COPY}
      className="relative my-2"
      placeholderClassName="h-12.5 w-full"
    >
      {(state, deps) => (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 py-2 pr-12 pl-3">
          <FileIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{state.name || deps.t(COPY.fallbackName)}</span>
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
        </div>
      )}
    </AttachmentNodeView>
  );
}

export default FileNodeView;
