import { pickerButton } from '../attachments/AttachmentFilePickerButton';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { FileNodeView } from './FileNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

export function createFile(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    kind: 'file',
    nodeView: FileNodeView,
    button: pickerButton('file', 'Paperclip'),
  });
}
