import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import type { Attachment } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
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
  const [watch] = useState(() => liveRow(get));
  const s = useAttachmentObjectUrl(id, watch);
  const text =
    s.status === 'ready'
      ? `${s.url}|${s.name}`
      : s.status === 'remote'
        ? `remote|${s.thumbnailUrl ?? ''}`
        : s.status;
  return <div data-testid="s">{text}</div>;
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

  it('a row without bytes is remote, with its thumbnail when it has one', async () => {
    const remote = { ...att(), blob: undefined, thumbnail: new Blob(['t']) };
    render(<Probe id="a1" get={async () => remote} />);
    await waitFor(() =>
      expect(screen.getByTestId('s').textContent).toMatch(/^remote\|blob:mock\//)
    );
  });

  it('turns ready when the bytes land, without a remount', async () => {
    const store = createMemoryLocalStore();
    const remote: Attachment = { ...att() };
    delete remote.blob;
    await store.attachments.add(remote);
    function Live() {
      const s = useAttachmentObjectUrl('a1', store.attachments.watch);
      return <div data-testid="s">{s.status}</div>;
    }
    render(<Live />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('remote'));
    await store.sync.received('a1', { blob: new Blob(['x']) });
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('ready'));
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
