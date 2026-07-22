import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
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

// Minimal fake of the ReactNodeView props surface the component reads.
function fakeProps(getAttachment: (id: string) => Promise<Attachment | undefined>) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    extension: { options: { getDeps: () => ({ getAttachment, t: (key: string) => key }) } },
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

  it('shows a broken state when the row is missing', async () => {
    render(<ImageNodeView {...fakeProps(async () => undefined)} />);
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
  });

  it('revokes the object URL on unmount', async () => {
    const { unmount } = render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    await screen.findByRole('img');
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});
