import { describe, expect, it } from 'vitest';
import { createFakeServer } from '@/test/fakeServer.ts';
import { createHalAccountService } from './HalAccountService.ts';
import { createHalRemote } from './HalRemote.ts';
import { createHalClient } from './hal.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const NOTE = crypto.randomUUID();
const empty = { notes: [], tags: [], noteTags: [], tombstones: [] };

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

  it('pulls from the bare link, follows `next`, and offers `resume` once caught up', async () => {
    const { server, remote } = await signedIn();
    server.sync.settings.pageSize = 1;
    const note = (id: string) => ({ id, state: 'active' as const, createdAt: T0, updatedAt: T0 });
    const second = crypto.randomUUID();
    await remote.push({ ...empty, notes: [note(NOTE), note(second)] });

    const first = await remote.pull(null);
    expect(first).toMatchObject({
      status: 'ok',
      notes: [{ id: NOTE, rev: 1 }],
      next: '/api/changes?since=1&from=0',
      resume: '/api/changes?since=1&from=0',
      seq: 2,
    });
    const last = await remote.pull(first.status === 'ok' ? first.next : null);
    expect(last).toMatchObject({
      status: 'ok',
      notes: [{ id: second, rev: 1 }],
      next: null,
      self: '/api/changes?since=1',
      resume: '/api/changes?since=2',
      seq: 2,
    });
  });

  it('410 is cursor-too-old', async () => {
    const { remote } = await signedIn();
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

  it('a blob over the limit is too-large, a repeat is stored', async () => {
    const { server, remote } = await signedIn();
    server.state.blobLimit = 3;
    const id = crypto.randomUUID();
    expect(await remote.putBlob(id, new Blob(['large'], { type: 'text/plain' }))).toBe('too-large');
    expect(await remote.putBlob(id, new Blob(['ok'], { type: 'text/plain' }))).toBe('stored');
    expect(await remote.putBlob(id, new Blob(['ok'], { type: 'text/plain' }))).toBe('stored');
  });
});
