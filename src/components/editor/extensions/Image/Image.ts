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

/**
 * Custom inline-image node (M3 Slice 1), built on the shared attachment-node
 * factory (M3 Slice 2). Unlike @tiptap/extension-image it persists NO src -
 * only `data-attachment-id`, resolved to a Blob object URL by the NodeView
 * (editor) and <NoteBody> (read-only).
 */
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
