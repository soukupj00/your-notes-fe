import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { ImageButton } from './ImageButton';
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
    name: 'imageAttachment',
    parseTag: 'img[data-attachment-id]',
    renderTag: 'img',
    insertCommandName: 'insertImageAttachment',
    nodeView: ImageNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: ImageButton,
      componentProps: { editor, getDeps, tooltip: t('editor.image.tooltip') },
    }),
  });
}
