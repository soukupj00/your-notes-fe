import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { useAttachmentObjectUrl } from './useAttachmentObjectUrl';

const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(() => revoke.mockReset());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    noteId: 'n1',
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x']),
    name: 'p.png',
    createdAt: now,
    updatedAt: now,
  };
}

function Probe({
  id,
  get,
}: {
  id: string | null;
  get: (i: string) => Promise<Attachment | undefined>;
}) {
  const s = useAttachmentObjectUrl(id, get);
  return <div data-testid="s">{s.status === 'ready' ? `${s.url}|${s.name}` : s.status}</div>;
}

describe('useAttachmentObjectUrl', () => {
  it('resolves to a ready url + name', async () => {
    render(<Probe id="a1" get={async () => att()} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toContain('blob:mock/'));
    expect(screen.getByTestId('s').textContent).toContain('p.png');
  });

  it('reports missing when the row is absent', async () => {
    render(<Probe id="a1" get={async () => undefined} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });

  it('revokes the url on unmount', async () => {
    const { unmount } = render(<Probe id="a1" get={async () => att()} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toContain('blob:mock/'));
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});
