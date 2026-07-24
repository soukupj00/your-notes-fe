import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
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
function props(
  get: (i: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  return {
    node: { attrs: { attachmentId: 'f1' } },
    editor: { isEditable: opts.isEditable ?? true },
    deleteNode: opts.deleteNode ?? vi.fn(),
    extension: { options: { getDeps: () => ({ getAttachment: get, t: (k: string) => k }) } },
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

  it('shows an unavailable state when the row is missing', async () => {
    render(<FileNodeView {...props(async () => undefined)} />);
    expect(await screen.findByText('editor.file.unavailable')).toBeInTheDocument();
  });

  it('confirms before deleting: clicking trash then Remove calls deleteNode once', async () => {
    const deleteNode = vi.fn();
    render(<FileNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.file.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    render(<FileNodeView {...props(async () => att(), { isEditable: false })} />);
    await screen.findByText('report.pdf');
    expect(screen.queryByRole('button', { name: 'editor.file.delete' })).not.toBeInTheDocument();
  });
});
