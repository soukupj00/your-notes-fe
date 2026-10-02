import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import type { Attachment } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
import { FileNodeView } from './FileNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'f1',
    noteId: 'n1',
    kind: 'file',
    mime: 'application/pdf',
    blob: new Blob(['x']),
    name: 'report.pdf',
    createdAt: now,
    updatedAt: now,
  };
}
function props(get: (i: string) => Promise<Attachment | undefined>) {
  const watchAttachment = liveRow(get);
  return {
    node: { attrs: { attachmentId: 'f1' } },
    extension: {
      options: { getDeps: () => ({ watchAttachment, t: (k: string) => k }) },
    },
  } as unknown as Parameters<typeof FileNodeView>[0];
}

describe('FileNodeView', () => {
  it('shows the filename and an open link at the resolved object URL', async () => {
    render(<FileNodeView {...props(async () => att())} />);
    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'editor.file.open' });
    await waitFor(() =>
      expect(link).toHaveAttribute('href', expect.stringContaining('blob:mock/'))
    );
  });

  it('a synced file not on this Device shows name, size and a download that brings it', async () => {
    const store = createMemoryLocalStore();
    const remote: Attachment = { ...att(), size: 2_400_000 };
    delete remote.blob;
    await store.attachments.add(remote);
    const downloadAttachment = vi.fn(async (id: string) => {
      await store.sync.received(id, { blob: new Blob(['%PDF']) });
      return true;
    });
    const p = {
      node: { attrs: { attachmentId: 'f1' } },
      editor: { isEditable: true },
      deleteNode: vi.fn(),
      extension: {
        options: {
          getDeps: () => ({
            watchAttachment: store.attachments.watch,
            downloadAttachment,
            t: (k: string) => k,
          }),
        },
      },
    } as unknown as Parameters<typeof FileNodeView>[0];
    render(<FileNodeView {...p} />);

    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.4 MB/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'editor.file.open' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'editor.attachment.download' }));
    expect(downloadAttachment).toHaveBeenCalledWith('f1');
    expect(await screen.findByRole('link', { name: 'editor.file.open' })).toHaveAttribute(
      'href',
      expect.stringContaining('blob:mock/')
    );
  });
});
