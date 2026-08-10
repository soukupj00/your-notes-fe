import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_MS = 5 * 60 * 1000;

const CANDIDATE_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** First MediaRecorder mime the browser supports, or null if unsupported. */
function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of CANDIDATE_MIME) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Ask the Permissions API whether the mic is already settled, so an
 * auto-started recording can fail fast with a real explanation instead of
 * calling `getUserMedia` and getting a silent no-op where the browser
 * remembers a past refusal. Returns `null` when the browser cannot answer
 * (Firefox and Safari do not expose the `microphone` descriptor), in which
 * case the only way to find out is to ask for the stream.
 */
async function queryMicrophonePermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return status.state;
  } catch {
    return null;
  }
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error';

/** Why start() failed. Distinct codes so the UI can tell a genuine refusal
 *  ('denied') apart from "no mic present" ('no-device') - the latter rejects
 *  instantly with no permission prompt, which must not read as a denial. */
export type RecorderError = 'unsupported' | 'denied' | 'no-device' | 'in-use' | 'failed';

/** Map a getUserMedia rejection to a RecorderError via its DOMException name. */
function mapGetUserMediaError(err: unknown): RecorderError {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'no-device';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'in-use';
    default:
      return 'failed';
  }
}

export interface AudioRecorder {
  status: RecorderStatus;
  elapsedMs: number;
  error: RecorderError | null;
  supported: boolean;
  /** Live mic stream while recording (for waveform visualization), else null. */
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mime: string; durationMs: number } | null>;
  cancel: () => void;
}

/** Wraps getUserMedia + MediaRecorder as a small state machine. Releases the
 *  mic (stops all tracks) on stop/cancel/unmount. Auto-stops at MAX_RECORDING_MS. */
export function useAudioRecorder(): AudioRecorder {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Bumped by cleanup() to invalidate any in-flight start() (e.g. unmount or
   *  cancel() while getUserMedia is still pending). */
  const startGenerationRef = useRef(0);

  const cleanup = useCallback(() => {
    startGenerationRef.current += 1;
    if (tickRef.current) clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
    recorderRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!supported) {
      setStatus('error');
      setError('unsupported');
      return;
    }
    const myGeneration = startGenerationRef.current + 1;
    startGenerationRef.current = myGeneration;
    setStatus('requesting');
    setError(null);
    try {
      // Only 'denied' is actionable up front: 'granted' and 'prompt' both end
      // in a getUserMedia call, and a browser that cannot answer just falls
      // through to it.
      if ((await queryMicrophonePermission()) === 'denied') {
        setStatus('error');
        setError('denied');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (startGenerationRef.current !== myGeneration) {
        // Unmounted or cancelled while permission was pending: release the
        // mic we just acquired and bail without touching any refs/status.
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        return;
      }
      streamRef.current = stream;
      setStream(stream);
      const mime = pickAudioMimeType() ?? '';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus('recording');
      tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    } catch (err) {
      cleanup();
      setStatus('error');
      setError(mapGetUserMediaError(err));
    }
  }, [supported, cleanup]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || status !== 'recording') return null;
    const durationMs = Date.now() - startedAtRef.current;
    const result = await new Promise<{ blob: Blob; mime: string }>((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        resolve({ blob: new Blob(chunksRef.current, { type: mime }), mime });
      };
      recorder.stop();
    });
    cleanup();
    setStatus('idle');
    setElapsedMs(0);
    return { ...result, durationMs };
  }, [status, cleanup]);

  // Cap the take. Owned by an effect keyed on the recording state rather than a
  // timer set inside start(), so stop() needs no back-reference into start()
  // and the timer is cancelled by the same state change that ends the take.
  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setTimeout(() => void stop(), MAX_RECORDING_MS);
    return () => clearTimeout(timer);
  }, [status, stop]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.stop();
    }
    cleanup();
    setStatus('idle');
    setElapsedMs(0);
  }, [cleanup]);

  return { status, elapsedMs, error, supported, stream, start, stop, cancel };
}
