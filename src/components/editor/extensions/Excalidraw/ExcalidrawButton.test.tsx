import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttachmentDeps } from '../attachments/deps';
import { ExcalidrawButton } from './ExcalidrawButton';

function setup() {
  const openExcalidraw = vi.fn();
  const createAttachment = vi.fn();
  const editor = {} as unknown as Editor;
  const deps = { openExcalidraw, createAttachment } as unknown as AttachmentDeps;
  return { editor, deps, openExcalidraw, createAttachment };
}

describe('ExcalidrawButton', () => {
  it('opens an empty modal - no attachment created, no node inserted', async () => {
    const { editor, deps, openExcalidraw, createAttachment } = setup();
    render(
      <TooltipProvider>
        <ExcalidrawButton editor={editor} getDeps={() => deps} tooltip="Insert drawing" />
      </TooltipProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Insert drawing' }));
    expect(openExcalidraw).toHaveBeenCalledWith({});
    expect(createAttachment).not.toHaveBeenCalled();
  });
});
