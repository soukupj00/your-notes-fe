import type { Editor } from '@tiptap/core';
import type { AttachmentDeps } from '../attachments/deps';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

// Placeholder - real record widget + file picker land in Task 8.
export function AudioRecordButton(_props: AudioRecordButtonProps) {
  return null;
}
