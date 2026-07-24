import type { Editor } from '@tiptap/core';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { FileButton } from './FileButton';
import { FileNodeView } from './FileNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom generic-file-attachment node built on the shared factory. Body
 *  serializes as <a data-attachment-id> (no href); the NodeView shows the
 *  filename + a generic icon + an open/download link. */
export function createFile(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'fileAttachment',
    parseTag: 'a[data-attachment-id]',
    renderTag: 'a',
    insertCommandName: 'insertFileAttachment',
    nodeView: FileNodeView,
    button: ({
      editor,
      getDeps,
      t,
    }: {
      editor: Editor;
      getDeps: () => AttachmentDeps;
      t: (k: string) => string;
    }) => ({
      component: FileButton,
      componentProps: { editor, getDeps, tooltip: t('editor.file.tooltip') },
    }),
  });
}
