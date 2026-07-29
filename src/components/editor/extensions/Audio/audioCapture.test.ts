import { describe, expect, it, vi } from 'vitest';
import { createAudioCaptureCoordinator } from './audioCapture.ts';

describe('createAudioCaptureCoordinator', () => {
  it('starts the recorder that is already registered', () => {
    const coordinator = createAudioCaptureCoordinator();
    const start = vi.fn();
    coordinator.registerRecorder(start);

    coordinator.requestRecording();

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('holds the request until a recorder registers', () => {
    // The editor asks as soon as it is ready; the mic button may mount after.
    const coordinator = createAudioCaptureCoordinator();
    coordinator.requestRecording();

    const start = vi.fn();
    coordinator.registerRecorder(start);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('consumes the request once, so a remount does not start a second take', () => {
    const coordinator = createAudioCaptureCoordinator();
    coordinator.requestRecording();

    const first = vi.fn();
    coordinator.registerRecorder(first)();
    const second = vi.fn();
    coordinator.registerRecorder(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('ignores a request once the recorder has unregistered', () => {
    const coordinator = createAudioCaptureCoordinator();
    const start = vi.fn();
    coordinator.registerRecorder(start)();

    coordinator.requestRecording();

    expect(start).not.toHaveBeenCalled();
  });
});
