import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNode } from 'react';

/** Holds a lost attachment's place, so the body still says something was here. For kinds
 *  with an `overlay` delete button; Audio's inline button needs its own placeholder. */
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
