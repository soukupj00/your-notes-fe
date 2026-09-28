import { describe, expect, it } from 'vitest';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalRemote } from '@/data/http/HalRemote.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import type { Attachment, Note } from '@/models.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { downloadAttachment } from './attachments.ts';
import { createSyncEngine } from './engine.ts';

const T0 = '2026-01-01T00:00:00.000Z';

function setup() {
  const server = createFakeServer();
  const owner = server.seedOwner('ada', 'correct horse');
  return { server, owner };
}

/** A signed-in Device, as in `engine.test.ts`, with the keep-everything Preference as a switch. */
async function device(server: FakeServer, accountId: string, name: string) {
  const hal = createHalClient(server.client().fetch);
  await createHalAccountService(hal).signIn('ada', 'correct horse', name);
  const store = createMemoryLocalStore();
  const remote = createHalRemote(hal);
  const settings = { keepEverything: false };
  const engine = createSyncEngine({
    store,
    remote,
    deviceName: () => name,
    keepEverything: () => settings.keepEverything,
  });
  await engine.adopt(accountId);
  return { store, engine, remote, settings };
}

/** A Note holding `attachments`, as the editor writes one. */
async function noteWith(
  store: ReturnType<typeof createMemoryLocalStore>,
  ...attachments: Omit<Attachment, 'noteId' | 'createdAt' | 'updatedAt'>[]
) {
  const note: Note = {
    id: crypto.randomUUID(),
    header: 'Trip',
    body: attachments.map((a) => `<img data-attachment-id="${a.id}">`).join(''),
    state: 'active',
    createdAt: T0,
    updatedAt: T0,
  };
  await store.notes.add(note);
  for (const a of attachments) {
    await store.attachments.add({ ...a, noteId: note.id, createdAt: T0, updatedAt: T0 });
  }
  return note;
}

const image = (size = 4) => ({
  id: crypto.randomUUID(),
  kind: 'image' as const,
  mime: 'image/png',
  name: 'cat.png',
  size,
  blob: new Blob(['x'.repeat(size)], { type: 'image/png' }),
  thumbnail: new Blob(['t'], { type: 'image/webp' }),
  thumbnailId: crypto.randomUUID(),
});
const file = (size: number, name = 'report.pdf') => ({
  id: crypto.randomUUID(),
  kind: 'file' as const,
  mime: 'application/pdf',
  name,
  size,
  blob: new Blob(['x'.repeat(size)], { type: 'application/pdf' }),
});

describe('sync engine: attachment bytes', () => {
  it('uploads the thumbnail and then the blob once the Note is accepted; a repeat run uploads nothing', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const img = image();
    const n = await noteWith(a.store, img);

    await a.engine.sync();
    expect(server.state.blobRequests).toEqual([`PUT ${img.thumbnailId}`, `PUT ${img.id}`]);
    expect(server.sync.row(owner.id, 'note', n.id)?.row.attachments).toEqual([
      expect.objectContaining({ id: img.id, thumbnailId: img.thumbnailId }),
    ]);

    await a.store.notes.update(n.id, () => ({ header: 'Trip 2' }));
    await a.engine.sync();
    expect(server.state.blobRequests).toHaveLength(2);
  });

  it('a blob over the limit is reported once and never retried', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    server.state.blobLimit = 10;
    const big = file(50, 'holiday.mov');
    const small = file(5);
    await noteWith(a.store, big, small);

    expect((await a.engine.sync()).tooLarge).toEqual(['holiday.mov']);
    expect(server.blobs.has(small.id)).toBe(true);
    const report = await a.engine.sync();
    expect(report.tooLarge).toEqual([]);
    expect(report.transfersLeft).toBe(0);
    expect(server.state.blobRequests.filter((r) => r.endsWith(big.id))).toHaveLength(1);
  });

  it('another Device pulls the rows and their thumbnails, never the full bytes', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const img = image();
    const doc = file(7);
    await noteWith(a.store, img, doc);
    await a.engine.sync();
    server.state.blobRequests.length = 0;

    await b.engine.sync();
    const rows = new Map((await b.store.attachments.list()).map((r) => [r.id, r]));
    expect(rows.get(img.id)).toMatchObject({ name: 'cat.png', thumbnailId: img.thumbnailId });
    expect(await rows.get(img.id)?.thumbnail?.text()).toBe('t');
    expect(rows.get(img.id)?.blob).toBeUndefined();
    expect(rows.get(doc.id)).toMatchObject({ name: 'report.pdf', size: 7 });
    expect(rows.get(doc.id)?.blob).toBeUndefined();
    expect(server.state.blobRequests).toEqual([`GET ${img.thumbnailId}`]);
    // Nothing it received is owed back.
    expect(await b.store.sync.dirty()).toMatchObject({ notes: [] });
  });

  it('a thumbnail the server does not have yet is left for the next run', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const img = image();
    await noteWith(a.store, img);
    await a.engine.sync();
    const held = server.blobs.get(img.thumbnailId)!;
    server.blobs.delete(img.thumbnailId);

    expect((await b.engine.sync()).transfersLeft).toBe(1);
    server.blobs.set(img.thumbnailId, held);
    expect((await b.engine.sync()).transfersLeft).toBe(0);
    expect((await b.store.attachments.get(img.id))?.thumbnail).toBeDefined();
  });

  it('a tap downloads one blob on demand, and the bytes are not uploaded back', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const doc = file(7);
    await noteWith(a.store, doc);
    await a.engine.sync();
    await b.engine.sync();

    expect(await downloadAttachment(b.store, b.remote, doc.id)).toBe(true);
    expect(await (await b.store.attachments.get(doc.id))?.blob?.text()).toBe('xxxxxxx');
    server.state.blobRequests.length = 0;
    await b.engine.sync();
    expect(server.state.blobRequests).toEqual([]);
    expect(await downloadAttachment(b.store, b.remote, crypto.randomUUID())).toBe(false);
  });

  it('keeping everything downloads every blob, smallest first', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const big = file(9);
    const small = file(2);
    await noteWith(a.store, big, small);
    await a.engine.sync();
    b.settings.keepEverything = true;
    server.state.blobRequests.length = 0;

    await b.engine.sync();
    expect(server.state.blobRequests).toEqual([`GET ${small.id}`, `GET ${big.id}`]);
    for (const row of await b.store.attachments.list()) expect(row.blob).toBeDefined();
  });

  it('a thumbnail from before thumbnailIds gets one, travels with the Note and uploads', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const legacy = { ...image(), thumbnailId: undefined };
    const n = await noteWith(a.store, legacy);

    await a.engine.sync();
    const minted = (await a.store.attachments.get(legacy.id))?.thumbnailId;
    expect(minted).toEqual(expect.any(String));
    await a.engine.sync();
    expect(server.blobs.has(minted!)).toBe(true);
    const pushed = server.sync.row(owner.id, 'note', n.id)?.row.attachments;
    expect(pushed).toEqual([expect.objectContaining({ thumbnailId: minted })]);
  });
});
