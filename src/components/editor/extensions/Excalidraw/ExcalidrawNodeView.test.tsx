import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';
import { ExcalidrawNodeView } from './ExcalidrawNodeView';

function att(overrides: Partial<Attachment> = {}): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    noteId: 'n1',
    kind: 'excalidraw',
    mime: 'application/json',
    blob: new Blob(['{}'], { type: 'application/json' }),
    preview: '<svg id="snap"></svg>',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function props(over: { openExcalidraw?: () => void; deleteNode?: () => void } = {}) {
  const openExcalidraw = over.openExcalidraw ?? vi.fn();
  const deleteNode = over.deleteNode ?? vi.fn();
  const p = {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: true },
    deleteNode,
    extension: {
      options: { getDeps: () => ({ openExcalidraw, t: (k: string) => k }) },
    },
  } as unknown as Parameters<typeof ExcalidrawNodeView>[0];
  return { p, openExcalidraw, deleteNode };
}

afterEach(async () => {
  await db.attachments.clear();
});

describe('ExcalidrawNodeView (preview)', () => {
  it('renders the live-queried preview SVG', async () => {
    await db.attachments.add(att());
    const { p } = props();
    const { container } = render(<ExcalidrawNodeView {...p} />);
    await waitFor(() => expect(container.querySelector('svg#snap')).toBeInTheDocument());
  });

  it('tapping the preview opens the modal with attachmentId + onDelete', async () => {
    await db.attachments.add(att());
    const { p, openExcalidraw } = props();
    render(<ExcalidrawNodeView {...p} />);
    const surface = await screen.findByRole('button', { name: 'editor.excalidraw.edit' });
    await userEvent.click(surface);
    expect(openExcalidraw).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentId: 'a1', onDelete: expect.any(Function) })
    );
  });

  it('the corner-X confirm deletes the node without opening the editor', async () => {
    await db.attachments.add(att());
    const { p, openExcalidraw, deleteNode } = props();
    render(<ExcalidrawNodeView {...p} />);
    await screen.findByRole('button', { name: 'editor.excalidraw.edit' });

    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );

    expect(deleteNode).toHaveBeenCalledTimes(1);
    expect(openExcalidraw).not.toHaveBeenCalled();
  });

  it('shows the unavailable box (with delete) when the row is missing', async () => {
    const { p } = props();
    render(<ExcalidrawNodeView {...p} />);
    await waitFor(() =>
      expect(screen.getByText('editor.excalidraw.unavailable')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'editor.excalidraw.delete' })).toBeInTheDocument();
  });
});
