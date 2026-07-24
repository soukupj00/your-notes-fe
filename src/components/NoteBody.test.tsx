import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';
import { NoteBody } from './NoteBody.tsx';

const { getAttachment } = vi.hoisted(() => ({
  getAttachment: vi.fn<(id: string) => Promise<Attachment | undefined>>(),
}));
vi.mock('@/hooks/data/useAttachmentActions.ts', () => ({
  useAttachmentActions: () => ({ getAttachment }),
}));

const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
  getAttachment.mockReset();
  getAttachment.mockImplementation((id) => db.attachments.get(id));
});
afterEach(async () => {
  revoke.mockReset();
  await db.attachments.clear();
});

function putAtt(id: string, overrides: Partial<Attachment> = {}): Promise<string> {
  const now = new Date().toISOString();
  const att: Attachment = {
    id,
    noteId: 'n1',
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
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

  it('uses an image thumbnail instead of the full blob when one is stored', async () => {
    const full = new Blob(['full'], { type: 'image/png' });
    const thumbnail = new Blob(['small'], { type: 'image/webp' });
    const now = new Date().toISOString();
    getAttachment.mockResolvedValue({
      id: 'a-thumb',
      noteId: 'n1',
      kind: 'image',
      mime: 'image/png',
      blob: full,
      thumbnail,
      createdAt: now,
      updatedAt: now,
    });

    render(<NoteBody html='<img data-attachment-id="a-thumb">' />);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());

    const objectUrlSource = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0];
    expect(objectUrlSource).toBe(thumbnail);
    expect(objectUrlSource).not.toBe(full);
  });

  it('renders plain HTML while removing unsafe pasted attributes', () => {
    const { container } = render(
      <NoteBody html='<p>just text</p><img src="x" onerror="alert(1)">' />
    );
    expect(screen.getByText('just text')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toHaveAttribute('onerror');
  });

  it('strips src-less audio attachment nodes (card shows a play button instead)', () => {
    render(<NoteBody html='<p>hi</p><audio data-attachment-id="au1"></audio>' />);
    expect(screen.getByText('hi')).toBeInTheDocument();
    // The audio node is removed, not rendered as a broken native player or chip.
    expect(document.querySelector('audio')).toBeNull();
    expect(document.querySelector('[data-attachment-chip="audio"]')).toBeNull();
  });

  it('injects the stored SVG preview for an excalidraw node (not stripped)', async () => {
    const now = new Date().toISOString();
    await db.attachments.put({
      id: 'draw-1',
      noteId: 'n1',
      kind: 'excalidraw',
      mime: 'application/json',
      blob: new Blob(['{}'], { type: 'application/json' }),
      preview: '<svg id="snap" width="400" height="100" viewBox="0 0 400 100"></svg>',
      createdAt: now,
      updatedAt: now,
    });
    const html = '<excalidraw-drawing data-attachment-id="draw-1"></excalidraw-drawing>';
    const { container } = render(<NoteBody html={html} />);
    const svg = await waitFor(() => {
      const resolved = container.querySelector<SVGElement>('svg[id="snap"]');
      expect(resolved).toBeInTheDocument();
      return resolved as SVGElement;
    });
    const drawing = container.querySelector<HTMLElement>('excalidraw-drawing');
    expect(drawing).toHaveStyle({ display: 'block', lineHeight: '0' });
    expect(svg).toHaveStyle({ display: 'block', width: '100%', height: 'auto' });
  });
});
