import type { Editor } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';

export interface ExcalidrawButtonProps {
  /** Kept for the shared button-view contract; the modal owns insertion now. */
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point. Opens the shared *empty* Excalidraw modal - nothing is
 *  created or inserted until the user hits Save (commit-on-Save). Unlike
 *  image/audio/video/file there is no file picker and no eager attachment. */
export function ExcalidrawButton({ getDeps, tooltip }: ExcalidrawButtonProps) {
  return (
    <ActionButton icon="PenTool" tooltip={tooltip} action={() => getDeps().openExcalidraw({})} />
  );
}
