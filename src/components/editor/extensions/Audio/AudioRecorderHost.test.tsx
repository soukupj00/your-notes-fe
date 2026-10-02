import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioRecorderHost } from './AudioRecorderHost';
import { createAudioCaptureCoordinator } from './audioCapture';
import type { AudioRecorder } from './useAudioRecorder';

const recorder: AudioRecorder = {
  status: 'idle',
  elapsedMs: 0,
  error: null,
  supported: true,
  stream: null,
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => null),
  cancel: vi.fn(),
};

vi.mock('./useAudioRecorder', () => ({ useAudioRecorder: () => recorder }));
vi.mock('./RecordingWaveform', () => ({ RecordingWaveform: () => null }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

const t = (key: string) => key;

function makeEditor() {
  const capture = createAudioCaptureCoordinator();
  const chain = { focus: () => chain, insertAudioAttachment: () => chain, run: vi.fn() };
  return {
    capture,
    editor: { storage: { audioAttachment: { capture } }, chain: () => chain } as never,
  };
}

const getDeps = () =>
  ({
    t,
    getNoteId: async () => 'note-1',
    createAttachment: vi.fn(async () => ({ id: 'att-1' })),
    onError: vi.fn(),
  }) as never;

describe('AudioRecorderHost', () => {
  beforeEach(() => {
    recorder.status = 'idle';
    vi.mocked(recorder.start).mockClear();
    vi.mocked(toast).mockClear();
    (recorder as { error: string | null }).error = null;
  });

  it('answers a recording request made before it mounted', () => {
    const { editor, capture } = makeEditor();
    capture.requestRecording();

    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('answers a request made after it mounted', () => {
    const { editor, capture } = makeEditor();
    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    capture.requestRecording();

    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while idle and the take controls while recording', () => {
    const { editor } = makeEditor();
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(screen.queryByRole('button', { name: 'editor.audio.stop' })).not.toBeInTheDocument();

    recorder.status = 'recording';
    rerender(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(screen.getByRole('button', { name: 'editor.audio.stop' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'editor.audio.cancel' })).toBeVisible();
  });

  it('publishes the recording status to the coordinator', () => {
    const { editor, capture } = makeEditor();
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(capture.isRecording()).toBe(false);

    recorder.status = 'recording';
    rerender(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(capture.isRecording()).toBe(true);
  });

  it('cancels the take from its Cancel control', async () => {
    const { editor } = makeEditor();
    recorder.status = 'recording';
    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    await userEvent.click(screen.getByRole('button', { name: 'editor.audio.cancel' }));

    expect(recorder.cancel).toHaveBeenCalled();
  });

  it('toasts a recorder error once, however often the deps getter changes identity', () => {
    const { editor } = makeEditor();
    recorder.status = 'error';
    (recorder as { error: string | null }).error = 'failed';
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('editor.audio.errors.failed');

    // A parent that passes a fresh arrow function each render must not re-fire the toast.
    rerender(<AudioRecorderHost editor={editor} getDeps={() => getDeps()} />);
    rerender(<AudioRecorderHost editor={editor} getDeps={() => getDeps()} />);

    expect(toast).toHaveBeenCalledTimes(1);
  });
});
