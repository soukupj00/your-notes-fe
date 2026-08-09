import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttachmentDeps } from '../attachments/deps';
import { AudioRecordButton } from './AudioRecordButton';
import { createAudioCaptureCoordinator } from './audioCapture';

vi.mock('sonner', () => ({ toast: vi.fn() }));

const recorder = {
  status: 'idle' as string,
  elapsedMs: 0,
  error: null as string | null,
  supported: true,
  stream: null as MediaStream | null,
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => ({
    blob: new Blob(['x'], { type: 'audio/webm' }),
    mime: 'audio/webm',
    durationMs: 3200,
  })),
  cancel: vi.fn(),
};
vi.mock('./useAudioRecorder', () => ({
  useAudioRecorder: () => recorder,
  MAX_RECORDING_MS: 300000,
}));

let insertAudioAttachmentMock: ReturnType<typeof vi.fn>;

function makeEditor(capture = createAudioCaptureCoordinator()) {
  insertAudioAttachmentMock = vi.fn(() => ({ run: vi.fn() }));
  return {
    chain: () => ({ focus: () => ({ insertAudioAttachment: insertAudioAttachmentMock }) }),
    // The button registers itself as the editor's recorder (auto-capture).
    storage: { audioAttachment: { capture } },
  } as unknown as Editor;
}

const createAttachment = vi.fn(async () => ({ id: 'att1' }));
const deps = {
  getNoteId: vi.fn(async () => 'note1'),
  createAttachment,
  onError: vi.fn(),
  t: (k: string) => k,
} as unknown as AttachmentDeps;

beforeEach(() => {
  recorder.status = 'idle';
  recorder.error = null;
  recorder.supported = true;
  recorder.stream = null;
  createAttachment.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('AudioRecordButton', () => {
  it('renders a mic button', () => {
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    expect(screen.getByRole('button', { name: 'rec' })).toBeInTheDocument();
  });

  it('starts recording when the mic button is clicked', async () => {
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'rec' }));
    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('opens the recording popover with a timer, stop and cancel while recording', () => {
    recorder.status = 'recording';
    recorder.elapsedMs = 3000;
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });

  it('cancel aborts the current take', async () => {
    recorder.status = 'recording';
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(recorder.cancel).toHaveBeenCalledTimes(1);
  });

  it('stop creates an audio attachment and inserts it', async () => {
    recorder.status = 'recording';
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(deps.getNoteId).toHaveBeenCalled());
    // The take's measured length rides along as metadata, so the card and the
    // player can show a duration without decoding the blob.
    expect(createAttachment).toHaveBeenCalledWith('note1', expect.any(File), 'audio', {
      duration: 3.2,
    });
    await waitFor(() =>
      expect(insertAudioAttachmentMock).toHaveBeenCalledWith({ attachmentId: 'att1' })
    );
  });

  it('shows a permission-denied toast on recorder error', () => {
    recorder.status = 'error';
    recorder.error = 'denied';
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    expect(toast).toHaveBeenCalledWith('editor.audio.errors.permission');
  });

  it.each([
    ['denied', 'editor.audio.errors.permission'],
    ['no-device', 'editor.audio.errors.no-device'],
    ['in-use', 'editor.audio.errors.in-use'],
    ['failed', 'editor.audio.errors.failed'],
  ])('maps recorder error %s to toast key %s', (error, key) => {
    recorder.status = 'error';
    recorder.error = error;
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    expect(toast).toHaveBeenCalledWith(key);
  });

  it('shows an unsupported toast when the recorder reports unsupported', () => {
    recorder.status = 'error';
    recorder.error = 'unsupported';
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    expect(toast).toHaveBeenCalledWith('editor.audio.errors.unsupported');
  });

  it('starts recording when the editor requests an auto-capture', () => {
    // "New voice note" opens the editor already recording, so the request may
    // land before or after this button mounts; either way it must start once.
    const capture = createAudioCaptureCoordinator();
    capture.requestRecording();

    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor(capture)} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );

    expect(recorder.start).toHaveBeenCalledTimes(1);
  });
});
