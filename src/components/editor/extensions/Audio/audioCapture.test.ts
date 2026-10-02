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
    // The editor asks as soon as it is ready; the recorder host may mount after.
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

  it('hands a request back when the recorder answering it goes away mid-take', async () => {
    // A recorder that unmounts while its `start` is still pending tears that
    // take down with it (React StrictMode does exactly this on every mount in
    // development): the request is not answered, so the next recorder takes it.
    const coordinator = createAudioCaptureCoordinator();
    const first = vi.fn(() => new Promise<void>(() => {}));
    coordinator.registerRecorder(first)();
    coordinator.requestRecording();
    expect(first).not.toHaveBeenCalled();

    const unregister = coordinator.registerRecorder(first);
    expect(first).toHaveBeenCalledTimes(1);
    unregister();
    coordinator.registerRecorder(first);

    expect(first).toHaveBeenCalledTimes(2);
  });

  it('does not restart a take whose recorder unregistered after it settled', async () => {
    const coordinator = createAudioCaptureCoordinator();
    const start = vi.fn(async () => {});
    const unregister = coordinator.registerRecorder(start);
    coordinator.requestRecording();
    await Promise.resolve();
    await Promise.resolve();

    unregister();
    coordinator.registerRecorder(start);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('ignores a request once the recorder has unregistered', () => {
    const coordinator = createAudioCaptureCoordinator();
    const start = vi.fn();
    coordinator.registerRecorder(start)();

    coordinator.requestRecording();

    expect(start).not.toHaveBeenCalled();
  });
});

describe('recording status', () => {
  it('starts not recording and notifies subscribers on every change', () => {
    const capture = createAudioCaptureCoordinator();
    const seen: boolean[] = [];
    const unsubscribe = capture.subscribe(() => seen.push(capture.isRecording()));

    expect(capture.isRecording()).toBe(false);
    capture.setRecording(true);
    capture.setRecording(false);
    unsubscribe();
    capture.setRecording(true);

    expect(seen).toEqual([true, false]);
  });

  it('does not notify when the value does not change', () => {
    const capture = createAudioCaptureCoordinator();
    const listener = vi.fn();
    capture.subscribe(listener);
    capture.setRecording(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
