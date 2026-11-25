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
  vi.restoreAllMocks();
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
    expect(external).toHaveAccessibleDescription('nav.newTab');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'tickets.pdf' })).toHaveAccessibleDescription('');
    // The node the Note does not list is gone rather than pointed anywhere.
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('share.page.footer');
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('contentinfo'));
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

  it('mounts the sanitized body as nodes, never re-parsing it from a string', async () => {
    const token = await shared({
      header: 'Nodes',
      body:
        '<p>Pack <a href="https://example.com">this</a></p>' +
        `<excalidraw-drawing data-attachment-id="${DRAWING}"></excalidraw-drawing>`,
      attachments: [meta(DRAWING, 'excalidraw', { preview: '<svg><rect/></svg>' })],
    });
    const reparses = [
      vi.spyOn(Element.prototype, 'innerHTML', 'set'),
      vi.spyOn(Element.prototype, 'insertAdjacentHTML'),
      vi.spyOn(Range.prototype, 'createContextualFragment'),
    ];
    render(<SharePage token={token} />);
    await screen.findByRole('heading', { name: 'Nodes' });

    expect(screen.getByRole('link', { name: 'this' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'notes.attachmentDrawing' })).toBeVisible();
    for (const reparse of reparses) expect(reparse).not.toHaveBeenCalled();
  });

  it("keeps a Drawing's picture and drops a `<use>` that reaches outside it", async () => {
    const preview =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><symbol id="image-1">' +
      '<image href="data:image/png;base64,iVBORw0KGgo="/></symbol></defs>' +
      '<use href="#image-1"/><use href="/api/blobs/x#icon"/></svg>';
    const token = await shared({
      header: 'Sketch',
      body: `<excalidraw-drawing data-attachment-id="${DRAWING}"></excalidraw-drawing>`,
      attachments: [meta(DRAWING, 'excalidraw', { preview })],
    });
    const { container } = render(<SharePage token={token} />);
    await screen.findByRole('heading', { name: 'Sketch' });

    const hrefs = [...container.querySelectorAll('use')].map((use) => use.getAttribute('href'));
    expect(hrefs).toEqual(['#image-1']);
  });

  it("opens a link inside a Drawing's preview in a new tab", async () => {
    const token = await shared({
      header: 'Linked',
      body: `<excalidraw-drawing data-attachment-id="${DRAWING}"></excalidraw-drawing>`,
      attachments: [
        meta(DRAWING, 'excalidraw', {
          preview: '<svg><a href="https://example.com/plan"><rect/></a></svg>',
        }),
      ],
    });
    const { container } = render(<SharePage token={token} />);
    await screen.findByRole('heading', { name: 'Linked' });

    const link = container.querySelector('svg a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([
    ['no name', undefined, 'notes.attachmentDrawing'],
    ["the app's own name", 'drawing.excalidraw', 'notes.attachmentDrawing'],
    ["the user's name", 'Floor plan.excalidraw', 'Floor plan.excalidraw'],
  ])('names a Drawing with %s as a picture', async (_, name, expected) => {
    const token = await shared({
      header: 'Sketch',
      body: `<excalidraw-drawing data-attachment-id="${DRAWING}"></excalidraw-drawing>`,
      attachments: [meta(DRAWING, 'excalidraw', { name, preview: '<svg><rect/></svg>' })],
    });
    render(<SharePage token={token} />);

    const drawing = await screen.findByRole('img', { name: expected });
    expect(drawing.querySelector('svg rect')).not.toBeNull();
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
