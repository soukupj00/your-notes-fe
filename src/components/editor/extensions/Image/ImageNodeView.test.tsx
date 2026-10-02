import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
import { ImageNodeView } from './ImageNodeView';

// jsdom lacks object-URL APIs.
const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(() => {
  revoke.mockReset();
});

function makeAtt(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    noteId: 'n1',
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    name: 'p.png',
    createdAt: now,
    updatedAt: now,
  };
}

function fakeProps(getAttachment: (id: string) => Promise<Attachment | undefined>) {
  const watchAttachment = liveRow(getAttachment);
  return {
    node: { attrs: { attachmentId: 'a1' } },
    extension: {
      options: { getDeps: () => ({ watchAttachment, t: (key: string) => key }) },
    },
  } as unknown as ReactNodeViewProps;
}

describe('ImageNodeView', () => {
  it('resolves the attachment Blob to an <img> src', async () => {
    render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img).toHaveAttribute('src', expect.stringContaining('blob:mock/')));
  });

  it('uses the attachment filename as the img accessible name', async () => {
    render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    const img = await screen.findByRole('img', { name: 'p.png' });
    expect(img).toHaveAttribute('alt', 'p.png');
  });

  it('revokes the object URL on unmount', async () => {
    const { unmount } = render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    await screen.findByRole('img');
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});

describe('ImageNodeView not downloaded', () => {
  it('shows the thumbnail at the full image size, so nothing moves when the bytes land', async () => {
    const remote: Attachment = {
      ...makeAtt(),
      thumbnail: new Blob(['t'], { type: 'image/webp' }),
      width: 1600,
      height: 1000,
    };
    delete remote.blob;
    render(<ImageNodeView {...fakeProps(async () => remote)} />);

    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '1000');
    expect(screen.getByRole('button', { name: 'editor.attachment.download' })).toBeInTheDocument();
  });
});
