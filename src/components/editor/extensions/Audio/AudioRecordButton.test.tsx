import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AudioRecordButton } from './AudioRecordButton';
import { createAudioCaptureCoordinator } from './audioCapture';

function makeEditor() {
  const capture = createAudioCaptureCoordinator();
  return { capture, editor: { storage: { audioAttachment: { capture } } } as never };
}

const getDeps = () => ({ t: (k: string) => k }) as never;

describe('AudioRecordButton', () => {
  beforeEach(() => {
    // jsdom has neither; without them the button is rightly disabled.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal('MediaRecorder', class {});
  });

  it('asks the coordinator to record; it does not own a recorder', async () => {
    const { editor, capture } = makeEditor();
    const start = vi.fn();
    capture.registerRecorder(start);
    render(
      <TooltipProvider>
        <AudioRecordButton editor={editor} getDeps={getDeps} tooltip="Record" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Record' }));

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('is disabled while a take is running', () => {
    const { editor, capture } = makeEditor();
    capture.setRecording(true);
    render(
      <TooltipProvider>
        <AudioRecordButton editor={editor} getDeps={getDeps} tooltip="Record" />
      </TooltipProvider>
    );

    expect(screen.getByRole('button', { name: 'Record' })).toBeDisabled();
  });
});
