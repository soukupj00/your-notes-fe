import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { AudioNodeView } from './AudioNodeView';
import { AudioRecordButton } from './AudioRecordButton';
import { type AudioAutoplayCoordinator, createAudioAutoplayCoordinator } from './audioAutoplay';
import { type AudioCaptureCoordinator, createAudioCaptureCoordinator } from './audioCapture';

export interface AudioAttachmentStorage {
  autoplay: AudioAutoplayCoordinator;
  /** Lets the editor start a recording without owning the recorder. */
  capture: AudioCaptureCoordinator;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audioAttachment: {
      insertAudioAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }

  interface Storage {
    audioAttachment: AudioAttachmentStorage;
  }
}

export function createAudio(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    kind: 'audio',
    nodeView: AudioNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: AudioRecordButton,
      componentProps: { editor, getDeps, tooltip: t('editor.audio.tooltip') },
    }),
  }).extend({
    addStorage() {
      return {
        autoplay: createAudioAutoplayCoordinator(),
        capture: createAudioCaptureCoordinator(),
      };
    },
  });
}
