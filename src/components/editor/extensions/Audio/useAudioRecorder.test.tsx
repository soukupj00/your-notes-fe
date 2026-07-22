import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

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
});
afterEach(() => vi.restoreAllMocks());

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
});
