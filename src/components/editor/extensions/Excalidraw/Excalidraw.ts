import type { Editor } from '@tiptap/core';
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
    name: 'excalidrawAttachment',
    parseTag: 'excalidraw-drawing[data-attachment-id]',
    renderTag: 'excalidraw-drawing',
    insertCommandName: 'insertExcalidrawAttachment',
    nodeView: ExcalidrawNodeView,
    button: ({
      editor,
      getDeps,
      t,
    }: {
      editor: Editor;
      getDeps: () => AttachmentDeps;
      t: (k: string) => string;
    }) => ({
      component: ExcalidrawButton,
      componentProps: { editor, getDeps, tooltip: t('editor.excalidraw.tooltip') },
    }),
  });
}
