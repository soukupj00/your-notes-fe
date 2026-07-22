import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_MS = 5 * 60 * 1000;

const CANDIDATE_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** First MediaRecorder mime the browser supports, or null if unsupported. */
export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of CANDIDATE_MIME) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error';

export interface AudioRecorder {
  status: RecorderStatus;
  elapsedMs: number;
  error: string | null;
  supported: boolean;
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
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped by cleanup() to invalidate any in-flight start() (e.g. unmount or
   *  cancel() while getUserMedia is still pending). */
  const startGenerationRef = useRef(0);

  const cleanup = useCallback(() => {
    startGenerationRef.current += 1;
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
    recorderRef.current = null;
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
      autoStopRef.current = setTimeout(() => {
        void stopInternalRef.current?.();
      }, MAX_RECORDING_MS);
    } catch {
      cleanup();
      setStatus('error');
      setError('denied');
    }
  }, [supported, cleanup]);

  const stopInternalRef = useRef<
    (() => Promise<{ blob: Blob; mime: string; durationMs: number } | null>) | null
  >(null);

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

  stopInternalRef.current = stop;

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

  return { status, elapsedMs, error, supported, start, stop, cancel };
}
