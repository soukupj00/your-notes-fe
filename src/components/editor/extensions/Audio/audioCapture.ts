export type RecorderCleanup = () => void;

export interface AudioCaptureCoordinator {
  /** Ask for a recording to start as soon as a recorder exists. */
  requestRecording(): void;
  /** `start` may return the take's promise: the request counts as answered
   *  once it settles, and is handed back if the recorder unregisters first. */
  registerRecorder(start: () => void | Promise<void>): RecorderCleanup;
  /** Whether a take is in progress. Set by the recorder's owner; read by buttons. */
  isRecording(): boolean;
  setRecording(recording: boolean): void;
  /** `useSyncExternalStore` shape, so a button can re-render on a change. */
  subscribe(listener: () => void): () => void;
}

/** Holds a "start recording" request until `AudioRecorderHost` registers, and carries the
 *  recording status back to the buttons. One-shot, but handed back if the recorder unmounts
 *  mid-start, as StrictMode does. See src/components/editor/CLAUDE.md, Audio. */
export function createAudioCaptureCoordinator(): AudioCaptureCoordinator {
  let pending = false;
  let current: (() => void | Promise<void>) | null = null;
  /** The recorder whose take is still starting, until that start settles. */
  let answering: (() => void | Promise<void>) | null = null;
  let recording = false;
  const listeners = new Set<() => void>();

  const fire = () => {
    const taker = current;
    if (!taker) return;
    pending = false;
    const take = taker();
    // A synchronous recorder has settled by now; only a promise is still open.
    if (!take) return;
    answering = taker;
    void take.finally(() => {
      if (answering === taker) answering = null;
    });
  };

  return {
    requestRecording() {
      pending = true;
      fire();
    },

    registerRecorder(start) {
      current = start;
      if (pending) fire();
      return () => {
        if (current === start) current = null;
        if (answering === start) {
          answering = null;
          pending = true;
        }
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
