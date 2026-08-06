import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNode } from 'react';

/**
 * What a NodeView draws when its blob is gone: a dashed placeholder holding the
 * node's place so the body still says something was here, plus the delete
 * control that is the only useful thing left to do with it.
 *
 * Shared by every attachment kind whose delete button is an `overlay` one - the
 * button positions itself absolutely, which is what the wrapper's `relative` is
 * for. Audio keeps its own placeholder: its delete button is the inline variant
 * and has to sit inside the row as a flex sibling, not over it.
 */
export function AttachmentUnavailable({
  label,
  deleteButton,
}: {
  label: string;
  deleteButton: ReactNode;
}) {
  return (
    <NodeViewWrapper as="div" className="relative my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
        <span className="flex-1 text-center">{label}</span>
      </div>
      {deleteButton}
    </NodeViewWrapper>
  );
}
