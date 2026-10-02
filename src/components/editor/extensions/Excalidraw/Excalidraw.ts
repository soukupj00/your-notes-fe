import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { ExcalidrawButton } from './ExcalidrawButton';
import { ExcalidrawNodeView } from './ExcalidrawNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    excalidrawAttachment: {
      insertExcalidrawAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

export function createExcalidraw(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    kind: 'excalidraw',
    nodeView: ExcalidrawNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: ExcalidrawButton,
      componentProps: { editor, getDeps, tooltip: t('editor.excalidraw.tooltip') },
    }),
  });
}
