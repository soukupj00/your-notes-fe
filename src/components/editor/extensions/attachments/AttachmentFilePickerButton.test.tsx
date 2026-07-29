import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AttachmentFilePickerButton } from './AttachmentFilePickerButton';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AttachmentFilePickerButton', () => {
  it('opens its hidden multi-file input with the configured MIME filter', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    const { container } = render(
      <TooltipProvider>
        <AttachmentFilePickerButton
          icon="Paperclip"
          tooltip="Attach files"
          accept="video/*"
          onFiles={vi.fn()}
        />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Attach files' }));

    const input = container.querySelector('input[type="file"]');
    expect(click).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('accept', 'video/*');
    expect(input).toHaveAttribute('multiple');
  });

  it('delivers selected files and resets the input for selecting the same file again', () => {
    const onFiles = vi.fn();
    const { container } = render(
      <TooltipProvider>
        <AttachmentFilePickerButton icon="Paperclip" tooltip="Attach files" onFiles={onFiles} />
      </TooltipProvider>
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    fireEvent.change(input);

    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });
});
