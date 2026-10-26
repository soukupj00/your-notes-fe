import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_RECORDING_MS, useAudioRecorder } from './useAudioRecorder';

class FakeRecorder {
  static isTypeSupported = vi.fn(() => true);
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = 'inactive';
  stream: unknown;
  opts: { mimeType?: string };
  constructor(stream: unknown, opts: { mimeType?: string }) {
    this.stream = stream;
    this.opts = opts;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc'], { type: this.opts.mimeType }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] };

beforeEach(() => {
  track.stop.mockReset();
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  // A test that stubs the permission answer must not leave it for the next.
  Object.defineProperty(globalThis.navigator, 'permissions', {
    configurable: true,
    value: undefined,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAudioRecorder', () => {
  it('start -> recording, stop -> blob + tracks released', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(true);
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('recording'));
    const outBox: { current: { blob: Blob } | null } = { current: null };
    await act(async () => {
      outBox.current = await result.current.stop();
    });
    expect(outBox.current?.blob).toBeInstanceOf(Blob);
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('releases the mic if unmounted while permission is pending', async () => {
    let resolveGetUserMedia: (s: unknown) => void = () => {};
    const deferred = new Promise((resolve) => {
      resolveGetUserMedia = resolve;
    });
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValueOnce(deferred);
    const startSpy = vi.spyOn(FakeRecorder.prototype, 'start');
    const { result, unmount } = renderHook(() => useAudioRecorder());

    let startPromise: Promise<void> = Promise.resolve();
    act(() => {
      startPromise = result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('requesting'));

    unmount();

    await act(async () => {
      resolveGetUserMedia(stream);
      await startPromise;
    });

    expect(track.stop).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('releases the mic if cancel() is called while permission is pending', async () => {
    let resolveGetUserMedia: (s: unknown) => void = () => {};
    const deferred = new Promise((resolve) => {
      resolveGetUserMedia = resolve;
    });
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValueOnce(deferred);
    const startSpy = vi.spyOn(FakeRecorder.prototype, 'start');
    const { result } = renderHook(() => useAudioRecorder());

    let startPromise: Promise<void> = Promise.resolve();
    act(() => {
      startPromise = result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('requesting'));

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      resolveGetUserMedia(stream);
      await startPromise;
    });

    expect(track.stop).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('sets error state when getUserMedia is denied', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('denied')
    );
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBeTruthy();
  });

  // getUserMedia rejects with distinct DOMException names; each must map to its
  // own code so the UI can tell "you refused" apart from "there is no mic".
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['NotReadableError', 'in-use'],
    ['SomethingElseError', 'failed'],
  ])('maps a %s rejection to error code %s', async (name, code) => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException('nope', name)
    );
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(code);
  });

  it('fails fast with a denial instead of asking a browser that already said no', async () => {
    const query = vi.fn(async () => ({ state: 'denied' }));
    Object.defineProperty(globalThis.navigator, 'permissions', {
      configurable: true,
      value: { query },
    });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('denied');
    // The whole point of the pre-check: no silent no-op getUserMedia call.
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('still records when the browser cannot answer the permission query', async () => {
    // Firefox/Safari reject the 'microphone' descriptor; asking for the stream
    // is then the only way to find out.
    const query = vi.fn(async () => {
      throw new TypeError('unsupported descriptor');
    });
    Object.defineProperty(globalThis.navigator, 'permissions', {
      configurable: true,
      value: { query },
    });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.status).toBe('recording'));
  });

  it('caps a take at MAX_RECORDING_MS and releases the mic', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('recording'));

    await act(async () => {
      vi.advanceTimersByTime(MAX_RECORDING_MS);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
