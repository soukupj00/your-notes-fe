import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';
import { NoteBody } from './NoteBody.tsx';

const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(async () => {
  revoke.mockReset();
  await db.attachments.clear();
});

function putAtt(id: string): Promise<string> {
  const now = new Date().toISOString();
  const att: Attachment = {
    id,
    noteId: 'n1',
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
  };
  return db.attachments.put(att);
}

describe('NoteBody', () => {
  it('hydrates data-attachment-id images to object URLs', async () => {
    await putAtt('a1');
    render(<NoteBody html='<p>hi</p><img data-attachment-id="a1">' />);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img).toHaveAttribute('src', expect.stringContaining('blob:mock/')));
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders plain HTML with no attachments unchanged', () => {
    render(<NoteBody html="<p>just text</p>" />);
    expect(screen.getByText('just text')).toBeInTheDocument();
  });

  it('renders a compact chip (not a player) for an audio attachment', async () => {
    const now = new Date().toISOString();
    await db.attachments.put({
      id: 'au1',
      noteId: 'n1',
      kind: 'audio',
      mime: 'audio/webm',
      blob: new Blob(['x']),
      duration: 14,
      createdAt: now,
      updatedAt: now,
    });
    render(<NoteBody html='<audio data-attachment-id="au1"></audio>' />);
    await waitFor(() => expect(screen.getByText(/0:14/)).toBeInTheDocument());
    // No <audio> element is mounted in the card (chip only).
    expect(document.querySelector('audio')).toBeNull();
  });
});
