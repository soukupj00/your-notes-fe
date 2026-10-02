import { pickerButton } from '../attachments/AttachmentFilePickerButton';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { ImageNodeView } from './ImageNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageAttachment: {
      insertImageAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Unlike @tiptap/extension-image it persists no src, only `data-attachment-id` (ADR 0007). */
export function createImage(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    kind: 'image',
    nodeView: ImageNodeView,
    button: pickerButton('image', 'ImagePlus'),
  });
}
