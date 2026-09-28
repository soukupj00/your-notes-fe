import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RevisionedNote } from '@/contract/index.ts';
import { createFakeServer } from '@/test/fakeServer.ts';
import SharePage from './share.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const AT = '2026-09-28T10:00:00.000Z';
const NOTE = '11111111-1111-4111-8111-111111111111';
const IMAGE = '22222222-2222-4222-8222-222222222222';
const DRAWING = '33333333-3333-4333-8333-333333333333';
const FILE = '44444444-4444-4444-8444-444444444444';
const meta = (id: string, kind: 'image' | 'excalidraw' | 'file', over = {}) => ({
  id,
  noteId: NOTE,
  kind,
  mime: 'application/octet-stream',
  createdAt: AT,
  updatedAt: AT,
  ...over,
});

/** A server holding one shared Note; the page reads it as a stranger would. */
async function shared(note: Partial<RevisionedNote>) {
  const server = createFakeServer();
  const owner = server.seedOwner();
  const row = { id: NOTE, state: 'active', createdAt: AT, updatedAt: AT, ...note } as const;
  server.sync.push(owner.id, 'seed', { notes: [row], tags: [], noteTags: [], tombstones: [] });
  const token = 'share-token-x';
  server.shares.push({
    id: crypto.randomUUID(),
    accountId: owner.id,
    noteId: NOTE,
    token,
    createdAt: AT,
  });
  vi.stubGlobal('fetch', server.client().fetch);
  return token;
}

describe('/share/$token', () => {
  it('shows the header and the body, with blobs from the page template', async () => {
    const token = await shared({
      header: 'Trip',
      body:
        `<p>Pack <a href="https://example.com">this</a></p><img data-attachment-id="${IMAGE}">` +
        `<excalidraw-drawing data-attachment-id="${DRAWING}"></excalidraw-drawing>` +
        `<a data-attachment-id="${FILE}"></a>` +
        '<img data-attachment-id="55555555-5555-4555-8555-555555555555">',
      attachments: [
        meta(IMAGE, 'image', { name: 'beach.png' }),
        meta(DRAWING, 'excalidraw', { preview: '<svg><rect width="4" height="4"/></svg>' }),
        meta(FILE, 'file', { name: 'tickets.pdf' }),
      ],
    });
    const { container } = render(<SharePage token={token} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Trip' })).toBeVisible();
    const image = screen.getByRole('img', { name: 'beach.png' });
    expect(image).toHaveAttribute('src', `/api/public/shares/${token}/blobs/${IMAGE}`);
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(container.querySelector('svg rect')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'tickets.pdf' })).toHaveAttribute(
      'href',
      `/api/public/shares/${token}/blobs/${FILE}`
    );
    const external = screen.getByRole('link', { name: 'this' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    // The node the Note does not list is gone rather than pointed anywhere.
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByText('share.page.footer')).toBeVisible();
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('renders neither a script nor an inline handler from the body', async () => {
    const token = await shared({
      header: 'Hostile',
      body: '<p>hi</p><script>window.pwned = 1</script><img src="x" onerror="window.pwned = 1"><a href="javascript:alert(1)">x</a>',
    });
    const { container } = render(<SharePage token={token} />);
    await screen.findByRole('heading', { name: 'Hostile' });

    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('a revoked, unknown or trashed share says nothing is shared', async () => {
    await shared({ header: 'Gone', state: 'trashed' });
    render(<SharePage token="share-token-x" />);
    expect(await screen.findByRole('heading', { name: 'share.page.gone' })).toBeVisible();
    expect(screen.queryByText('Gone')).toBeNull();
  });

  it('says so when the server cannot be read', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 429 }));
    render(<SharePage token="t" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('share.page.failed');
  });
});
