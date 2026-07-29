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

  // A rejected lookup used to be an unhandled rejection that also pinned the
  // node view on 'loading' forever - a broken attachment showed as a permanent
  // spinner rather than as missing.
  it('reports missing when the lookup fails', async () => {
    render(<Probe id="a1" get={() => Promise.reject(new Error('db is gone'))} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });

  it('reports missing without a round trip when there is no id to resolve', () => {
    render(<Probe id={null} get={async () => att()} />);
    expect(screen.getByTestId('s').textContent).toBe('missing');
  });

  it('revokes the url on unmount', async () => {
    const { unmount } = render(<Probe id="a1" get={async () => att()} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toContain('blob:mock/'));
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});
