export type RecorderCleanup = () => void;

export interface AudioCaptureCoordinator {
  /** Ask for a recording to start as soon as a recorder exists. */
  requestRecording(): void;
  registerRecorder(start: () => void): RecorderCleanup;
}

/**
 * Bridges "open this note straight into recording" (asked for by the editor,
 * from the speed-dial's intent) to the mic button that actually owns the
 * recorder. The two mount independently, so the request is held until a
 * recorder registers - the same pending-then-fire shape as `audioAutoplay`.
 *
 * One-shot on purpose: a request is consumed by the first recorder that takes
 * it, so remounting the toolbar cannot start a second take.
 */
export function createAudioCaptureCoordinator(): AudioCaptureCoordinator {
  let pending = false;
  let current: (() => void) | null = null;

  return {
    requestRecording() {
      if (current) {
        current();
        return;
      }
      pending = true;
    },

    registerRecorder(start) {
      current = start;
      if (pending) {
        pending = false;
        start();
      }
      return () => {
        if (current === start) current = null;
      };
    },
  };
}
