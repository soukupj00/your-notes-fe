import { pickerButton } from '../attachments/AttachmentFilePickerButton';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { VideoNodeView } from './VideoNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoAttachment: {
      insertVideoAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

export function createVideo(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    kind: 'video',
    nodeView: VideoNodeView,
    button: pickerButton('video', 'FileVideo'),
  });
}
