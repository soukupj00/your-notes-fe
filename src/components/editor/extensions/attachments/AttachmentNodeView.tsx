import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';
import { AttachmentDeleteButton } from './AttachmentDeleteButton';
import { AttachmentNotDownloaded } from './AttachmentNotDownloaded';
import { AttachmentUnavailable } from './AttachmentUnavailable';
import type { AttachmentDeps } from './deps';
import { type AttachmentUrlState, useAttachmentObjectUrl } from './useAttachmentObjectUrl';

export type ReadyAttachment = Extract<AttachmentUrlState, { status: 'ready' }>;

/** The three i18n keys a kind supplies: its delete label, its missing label, and the name
 *  shown for a row that has none. */
export interface AttachmentNodeCopy {
  delete: string;
  unavailable: string;
  fallbackName: string;
}

interface AttachmentNodeViewProps {
  props: ReactNodeViewProps;
  copy: AttachmentNodeCopy;
  /** Wrapper classes for the ready and loading states; the remote and missing placeholders
   *  bring their own. */
  className: string;
  /** Sizes the box the loading pulse reserves. */
  placeholderClassName?: string;
  children: (state: ReadyAttachment, deps: AttachmentDeps) => ReactNode;
}

/** What every media node draws besides its ready element: the delete overlay, the known-but-
 *  not-downloaded and missing placeholders, and a pulse that reserves a box while the row loads.
 *  The wrapper and the delete overlay stay the same elements from loading to ready, so a delete
 *  tap during loading is not lost. */
export function AttachmentNodeView({
  props,
  copy,
  className,
  // An inline-block wrapper gives a percentage width nothing to measure.
  placeholderClassName = 'h-32 w-64 max-w-full',
  children,
}: AttachmentNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t(copy.delete)}
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
        fallbackName={deps.t(copy.fallbackName)}
        deleteButton={deleteButton}
      />
    );
  }

  if (state.status === 'missing') {
    return <AttachmentUnavailable label={deps.t(copy.unavailable)} deleteButton={deleteButton} />;
  }

  return (
    <NodeViewWrapper as="div" className={className} data-drag-handle>
      {state.status === 'ready' ? (
        children(state, deps)
      ) : (
        <div
          className={cn('animate-pulse rounded-md bg-muted', placeholderClassName)}
          aria-hidden
        />
      )}
      {deleteButton}
    </NodeViewWrapper>
  );
}
