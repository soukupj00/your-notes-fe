import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { VideoNodeView } from './VideoNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'v1',
    noteId: 'n1',
    kind: 'video',
    mime: 'video/mp4',
    blob: new Blob(['x']),
    name: 'clip.mp4',
    createdAt: now,
    updatedAt: now,
  };
}
function props(
  get: (i: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  return {
    node: { attrs: { attachmentId: 'v1' } },
    editor: { isEditable: opts.isEditable ?? true },
    deleteNode: opts.deleteNode ?? vi.fn(),
    extension: { options: { getDeps: () => ({ getAttachment: get, t: (k: string) => k }) } },
  } as unknown as Parameters<typeof VideoNodeView>[0];
}

describe('VideoNodeView', () => {
  it('resolves the blob into the video element src', async () => {
    render(<VideoNodeView {...props(async () => att())} />);
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toHaveAttribute('src', expect.stringContaining('blob:mock/'));
    });
  });

  it('shows an unavailable state when the row is missing', async () => {
    render(<VideoNodeView {...props(async () => undefined)} />);
    expect(await screen.findByText('editor.video.unavailable')).toBeInTheDocument();
  });

  it('confirms before deleting: clicking trash then Remove calls deleteNode once', async () => {
    const deleteNode = vi.fn();
    render(<VideoNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.video.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('does not delete when the confirm dialog is cancelled', async () => {
    const deleteNode = vi.fn();
    render(<VideoNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.video.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.cancel' })
    );
    expect(deleteNode).not.toHaveBeenCalled();
  });

  it('removes the node from the unavailable state too', async () => {
    const deleteNode = vi.fn();
    render(<VideoNodeView {...props(async () => undefined, { deleteNode })} />);
    await screen.findByText('editor.video.unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'editor.video.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    render(<VideoNodeView {...props(async () => att(), { isEditable: false })} />);
    await waitFor(() => expect(document.querySelector('video')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'editor.video.delete' })).not.toBeInTheDocument();
  });
});
