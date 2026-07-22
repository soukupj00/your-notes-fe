import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttachmentDeps } from '../attachments/deps';
import { AudioRecordButton } from './AudioRecordButton';

vi.mock('sonner', () => ({ toast: vi.fn() }));

const recorder = {
  status: 'idle' as string,
  elapsedMs: 0,
  error: null as string | null,
  supported: true,
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

function makeEditor() {
  insertAudioAttachmentMock = vi.fn(() => ({ run: vi.fn() }));
  return {
    chain: () => ({ focus: () => ({ insertAudioAttachment: insertAudioAttachmentMock }) }),
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

  it('stop creates an audio attachment and inserts it', async () => {
    recorder.status = 'recording';
    render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(deps.getNoteId).toHaveBeenCalled());
    expect(createAttachment).toHaveBeenCalledWith('note1', expect.any(File), 'audio');
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

  it('picking a file inserts it through the shared attachment pipeline', async () => {
    const { container } = render(
      <TooltipProvider>
        <AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />
      </TooltipProvider>
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'a.webm', { type: 'audio/webm' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(createAttachment).toHaveBeenCalledWith('note1', file, 'audio'));
    await waitFor(() =>
      expect(insertAudioAttachmentMock).toHaveBeenCalledWith({ attachmentId: 'att1' })
    );
  });
});
