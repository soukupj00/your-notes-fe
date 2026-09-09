export type RecorderCleanup = () => void;

export interface AudioCaptureCoordinator {
  /** Ask for a recording to start as soon as a recorder exists. */
  requestRecording(): void;
  registerRecorder(start: () => void): RecorderCleanup;
  /** Whether a take is in progress. Set by the recorder's owner; read by buttons. */
  isRecording(): boolean;
  setRecording(recording: boolean): void;
  /** `useSyncExternalStore` shape, so a button can re-render on a change. */
  subscribe(listener: () => void): () => void;
}

/**
 * Bridges "start recording" (asked for by the editor from the speed-dial's
 * intent, or by the toolbar's mic button) to the one recorder the editor owns
 * (`AudioRecorderHost`). The two mount independently, so a request is held
 * until a recorder registers - the same pending-then-fire shape as
 * `audioAutoplay`.
 *
 * It also carries the recording status the other way, so a mic button in a
 * collapsed toolbar menu - or none at all - can still tell whether a take is
 * running. The recorder used to live in that button, which meant a phone's
 * collapsed media menu had no recorder until it was opened, and the dial's
 * request waited on a button that was not there.
 *
 * One-shot on purpose: a request is consumed by the first recorder that takes
 * it, so remounting cannot start a second take.
 */
export function createAudioCaptureCoordinator(): AudioCaptureCoordinator {
  let pending = false;
  let current: (() => void) | null = null;
  let recording = false;
  const listeners = new Set<() => void>();

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

    isRecording() {
      return recording;
    },

    setRecording(next) {
      if (next === recording) return;
      recording = next;
      for (const listener of listeners) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
