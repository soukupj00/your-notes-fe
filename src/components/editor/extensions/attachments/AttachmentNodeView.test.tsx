import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment, AttachmentKind } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
import { FileNodeView } from '../File/FileNodeView';
import { ImageNodeView } from '../Image/ImageNodeView';
import { VideoNodeView } from '../Video/VideoNodeView';

// jsdom lacks object-URL APIs.
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const KINDS: {
  kind: AttachmentKind;
  View: ComponentType<ReactNodeViewProps>;
  mime: string;
  name: string;
  ready: string;
}[] = [
  { kind: 'image', View: ImageNodeView, mime: 'image/png', name: 'p.png', ready: 'img' },
  { kind: 'video', View: VideoNodeView, mime: 'video/mp4', name: 'clip.mp4', ready: 'video' },
  {
    kind: 'file',
    View: FileNodeView,
    mime: 'application/pdf',
    name: 'report.pdf',
    ready: 'a[href]',
  },
];

function row(kind: AttachmentKind, mime: string, name: string, blob?: Blob): Attachment {
  const now = new Date().toISOString();
  return { id: 'a1', noteId: 'n1', kind, mime, blob, name, createdAt: now, updatedAt: now };
}

function props(
  get: (id: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  const watchAttachment = liveRow(get);
  return {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: opts.isEditable ?? true },
    deleteNode: opts.deleteNode ?? vi.fn(),
    extension: {
      options: { getDeps: () => ({ watchAttachment, t: (k: string) => k }) },
    },
  } as unknown as ReactNodeViewProps;
}

describe.each(KINDS)('$kind node view through the shell', ({ kind, View, mime, name, ready }) => {
  const bytes = () => row(kind, mime, name, new Blob(['x'], { type: mime }));

  it('pulses while the row loads, then draws the ready element inside the same wrapper', async () => {
    let land!: (a: Attachment) => void;
    const pending = new Promise<Attachment>((resolve) => {
      land = resolve;
    });
    const { container } = render(<View {...props(() => pending)} />);
    const wrapper = container.firstElementChild;
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelector(ready)).toBeNull();
    expect(screen.getByRole('button', { name: `editor.${kind}.delete` })).toBeInTheDocument();

    land(bytes());
    await waitFor(() => expect(container.querySelector(ready)).not.toBeNull());
    expect(container.querySelector('.animate-pulse')).toBeNull();
    // Same element across the swap: a delete tap during loading must not be lost to a remount.
    expect(container.firstElementChild).toBe(wrapper);
  });

  it('holds the place of a missing row and still lets it be removed', async () => {
    const deleteNode = vi.fn();
    render(<View {...props(async () => undefined, { deleteNode })} />);
    expect(await screen.findByText(`editor.${kind}.unavailable`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('offers a download for a row synced without its bytes', async () => {
    render(<View {...props(async () => row(kind, mime, name))} />);
    expect(
      await screen.findByRole('button', { name: 'editor.attachment.download' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `editor.${kind}.delete` })).toBeInTheDocument();
    expect(screen.queryByText(`editor.${kind}.unavailable`)).not.toBeInTheDocument();
  });

  it('confirms before deleting: a cancel keeps the node, a confirm removes it once', async () => {
    const deleteNode = vi.fn();
    render(<View {...props(async () => bytes(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.cancel' })
    );
    expect(deleteNode).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    const { container } = render(<View {...props(async () => bytes(), { isEditable: false })} />);
    await waitFor(() => expect(container.querySelector(ready)).not.toBeNull());
    expect(screen.queryByRole('button', { name: `editor.${kind}.delete` })).not.toBeInTheDocument();
  });
});
