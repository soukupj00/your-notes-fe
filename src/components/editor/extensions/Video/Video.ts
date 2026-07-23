import type { Editor } from '@tiptap/core';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { VideoButton } from './VideoButton';
import { VideoNodeView } from './VideoNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoAttachment: {
      insertVideoAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom video-attachment node built on the shared factory. Body serializes as
 *  <video data-attachment-id> (no src); the NodeView is a native <video controls>. */
export function createVideo(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'videoAttachment',
    parseTag: 'video[data-attachment-id]',
    renderTag: 'video',
    insertCommandName: 'insertVideoAttachment',
    nodeView: VideoNodeView,
    button: ({
      editor,
      getDeps,
      t,
    }: {
      editor: Editor;
      getDeps: () => AttachmentDeps;
      t: (k: string) => string;
    }) => ({
      component: VideoButton,
      componentProps: { editor, getDeps, tooltip: t('editor.video.tooltip') },
    }),
  });
}
