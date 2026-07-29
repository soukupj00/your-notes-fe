export type ReadyAudioCleanup = () => void;

export interface AudioAutoplayCoordinator {
  requestAutoplay(attachmentId: string): void;
  registerReadyAudio(attachmentId: string, play: () => void): ReadyAudioCleanup;
}

/** Coordinates one-shot autoplay across independently loaded note and audio data. */
export function createAudioAutoplayCoordinator(): AudioAutoplayCoordinator {
  let pendingAttachmentId: string | null = null;
  const readyAudio = new Map<string, () => void>();

  return {
    requestAutoplay(attachmentId) {
      const play = readyAudio.get(attachmentId);
      if (play) {
        play();
        return;
      }
      pendingAttachmentId = attachmentId;
    },

    registerReadyAudio(attachmentId, play) {
      readyAudio.set(attachmentId, play);
      if (pendingAttachmentId === attachmentId) {
        pendingAttachmentId = null;
        play();
      }
      return () => {
        if (readyAudio.get(attachmentId) === play) {
          readyAudio.delete(attachmentId);
        }
      };
    },
  };
}
