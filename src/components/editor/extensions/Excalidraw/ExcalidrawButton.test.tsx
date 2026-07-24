import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttachmentDeps } from '../attachments/deps';
import { ExcalidrawButton } from './ExcalidrawButton';

function setup() {
  const run = vi.fn();
  const insert = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ insertExcalidrawAttachment: insert }));
  const chain = vi.fn(() => ({ focus }));
  const editor = { chain } as unknown as Editor;
  const createAttachment = vi.fn(async () => ({ id: 'att-1' }));
  const onError = vi.fn();
  const deps = {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment,
    onError,
  } as unknown as AttachmentDeps;
  return { editor, deps, createAttachment, insert, onError };
}

describe('ExcalidrawButton', () => {
  it('creates an empty excalidraw scene and inserts the node', async () => {
    const { editor, deps, createAttachment, insert } = setup();
    render(
      <TooltipProvider>
        <ExcalidrawButton editor={editor} getDeps={() => deps} tooltip="Insert drawing" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Insert drawing' }));
    await vi.waitFor(() => {
      expect(createAttachment).toHaveBeenCalledWith('note-1', expect.any(File), 'excalidraw');
      expect(insert).toHaveBeenCalledWith({ attachmentId: 'att-1' });
    });
  });

  it('routes a creation failure through onError instead of throwing', async () => {
    const { editor, deps, createAttachment, onError } = setup();
    (createAttachment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(
      <TooltipProvider>
        <ExcalidrawButton editor={editor} getDeps={() => deps} tooltip="Insert drawing" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Insert drawing' }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('insert-failed'));
  });
});
