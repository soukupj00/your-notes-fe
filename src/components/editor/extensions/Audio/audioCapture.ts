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
 * it, so remounting cannot start a second take - with one exception. A
 * recorder that unregisters while its take is still starting tears that take
 * down with it (its hook releases the mic on unmount), so the request was never
 * really answered and is handed back for the next recorder. React StrictMode
 * does exactly this on every mount in development: without it the dial's
 * voice note sat at "requesting" forever.
 */
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
