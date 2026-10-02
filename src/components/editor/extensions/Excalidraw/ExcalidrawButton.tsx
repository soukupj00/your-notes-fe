import type { Editor } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';

export interface ExcalidrawButtonProps {
  /** Kept for the shared button-view contract; the modal owns insertion now. */
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Opens an empty drawing: nothing is created or inserted until Save (commit-on-Save). */
export function ExcalidrawButton({ getDeps, tooltip }: ExcalidrawButtonProps) {
  return (
    <ActionButton icon="PenTool" tooltip={tooltip} action={() => getDeps().openExcalidraw({})} />
  );
}
