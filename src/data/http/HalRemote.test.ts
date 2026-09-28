import { describe, expect, it } from 'vitest';
import { createFakeServer } from '@/test/fakeServer.ts';
import { createHalAccountService } from './HalAccountService.ts';
import { createHalRemote } from './HalRemote.ts';
import { createHalClient } from './hal.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const NOTE = crypto.randomUUID();
const empty = { notes: [], tags: [], noteTags: [], tombstones: [] };
const links = (next?: string) => ({
  self: { href: '/api/changes' },
  stream: { href: '/api/changes/stream' },
  ...(next ? { next: { href: next } } : {}),
});

async function signedIn() {
  const server = createFakeServer();
  const hal = createHalClient(server.fetch);
  const owner = server.seedOwner('ada', 'correct horse');
  await createHalAccountService(hal).signIn('ada', 'correct horse', 'Phone');
  return { server, remote: createHalRemote(hal), owner };
}

describe('HalRemote', () => {
  it('identity is the signed-in Account', async () => {
    const { remote, owner } = await signedIn();
    expect(await remote.identity()).toBe(owner.id);
  });

  it('pushes a batch and answers one outcome per row', async () => {
    const { server, remote } = await signedIn();
    const note = { id: NOTE, state: 'active' as const, createdAt: T0, updatedAt: T0 };
    const outcomes = await remote.push({ ...empty, notes: [{ ...note, attachments: [] }] });
    expect(outcomes).toEqual([{ kind: 'note', id: NOTE, status: 'accepted', rev: 1 }]);
    expect(server.state.pushed).toHaveLength(1);
  });

  it('pulls from the bare link, follows `next`, and maps its absence to null', async () => {
    const { server, remote } = await signedIn();
    server.state.feed.set(0, { ...empty, seq: 2, _links: links('/api/changes?since=1') });
    server.state.feed.set(1, { ...empty, seq: 2, _links: links() });

    const first = await remote.pull(null);
    expect(first).toMatchObject({ status: 'ok', next: '/api/changes?since=1' });
    const last = await remote.pull(first.status === 'ok' ? first.next : null);
    expect(last).toEqual({ status: 'ok', ...empty, next: null });
  });

  it('410 is cursor-too-old', async () => {
    const { server, remote } = await signedIn();
    server.state.feedGone = true;
    expect(await remote.pull('/api/changes?since=99')).toEqual({ status: 'cursor-too-old' });
  });

  it('puts bytes once by id and reads them back; a missing blob is undefined', async () => {
    const { server, remote } = await signedIn();
    const id = crypto.randomUUID();
    await remote.putBlob(id, new Blob(['png'], { type: 'image/png' }));
    await remote.putBlob(id, new Blob(['png'], { type: 'image/png' }));
    expect(server.blobs.size).toBe(1);
    expect(await (await remote.getBlob(id))?.text()).toBe('png');
    expect(await remote.getBlob(crypto.randomUUID())).toBeUndefined();
  });
});
