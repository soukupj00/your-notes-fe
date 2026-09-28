import { describe, expect, it } from 'vitest';
import type { Note, RevisionedNote } from '@/contract/index.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { createHalAccountService } from './HalAccountService.ts';
import { createHalClient } from './hal.ts';
import { fetchSharedNote, sharedBlobUrl } from './publicShare.ts';

const AT = '2026-09-28T10:00:00.000Z';
const NOTE_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const THUMB_ID = '33333333-3333-4333-8333-333333333333';

const note = (over: Partial<Note> = {}): Note => ({
  id: NOTE_ID,
  header: 'Groceries',
  body: '<p>Milk</p>',
  state: 'active',
  attachments: [
    {
      id: IMAGE_ID,
      noteId: NOTE_ID,
      kind: 'image',
      mime: 'image/png',
      thumbnailId: THUMB_ID,
      createdAt: AT,
      updatedAt: AT,
    },
  ],
  createdAt: AT,
  updatedAt: AT,
  ...over,
});

/** A Note as the server holds it after a Device pushed it. */
function seedNote(server: FakeServer, accountId: string, row: RevisionedNote = note()) {
  server.sync.push(accountId, 'seed', { notes: [row], tags: [], noteTags: [], tombstones: [] });
}

async function signedIn(server: FakeServer, username: string, password: string) {
  const service = createHalAccountService(createHalClient(server.client().fetch));
  await service.signIn(username, password, 'Phone');
  return service;
}

describe('Share Links through AccountService', () => {
  it('mints once per Note, lists and revokes', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    seedNote(server, owner.id);
    const service = await signedIn(server, 'ada', 'correct horse');

    const share = await service.share(NOTE_ID);
    expect(share).toMatchObject({ noteId: NOTE_ID, createdAt: AT });
    expect(await service.share(NOTE_ID)).toEqual(share);
    expect(await service.shares()).toEqual([share]);

    await service.revokeShare(share.id);
    expect(await service.shares()).toEqual([]);
    await expect(service.revokeShare(share.id)).rejects.toMatchObject({ status: 404 });
  });

  it('a member shares their own Notes too, and a Note the server lacks is a 404', async () => {
    const server = createFakeServer();
    server.seedOwner();
    const member = server.seedMember('bob', 'battery staple');
    const service = await signedIn(server, 'bob', 'battery staple');
    await expect(service.share(NOTE_ID)).rejects.toMatchObject({ status: 404 });

    seedNote(server, member.id);
    expect((await service.share(NOTE_ID)).noteId).toBe(NOTE_ID);
  });
});

describe('fetchSharedNote', () => {
  it('reads the Note with no session and builds blob URLs from its template', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    seedNote(server, owner.id);
    server.blobs.set(IMAGE_ID, new Uint8Array([1, 2, 3]));
    const { token } = await (await signedIn(server, 'ada', 'correct horse')).share(NOTE_ID);

    const stranger = server.client().fetch;
    const shared = await fetchSharedNote(token, stranger);
    if (shared === 'gone') throw new Error('expected the Note');
    expect(shared.note).toMatchObject({ header: 'Groceries', body: '<p>Milk</p>' });
    expect(shared.note).not.toHaveProperty('rev');

    const url = sharedBlobUrl(shared, IMAGE_ID);
    expect(url).toBe(`/api/public/shares/${token}/blobs/${IMAGE_ID}`);
    expect((await stranger(url)).status).toBe(200);
    // Listed as a thumbnail but never uploaded, and not listed at all: both 404.
    expect((await stranger(sharedBlobUrl(shared, THUMB_ID))).status).toBe(404);
    expect((await stranger(sharedBlobUrl(shared, NOTE_ID))).status).toBe(404);
  });

  it('answers gone for an unknown, revoked or trashed share', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    seedNote(server, owner.id);
    const service = await signedIn(server, 'ada', 'correct horse');
    const stranger = server.client().fetch;
    expect(await fetchSharedNote('not-a-token', stranger)).toBe('gone');

    const share = await service.share(NOTE_ID);
    seedNote(server, owner.id, { ...note({ state: 'trashed' }), rev: 1 });
    expect(await fetchSharedNote(share.token, stranger)).toBe('gone');

    seedNote(server, owner.id, { ...note(), rev: 2 });
    expect(await fetchSharedNote(share.token, stranger)).not.toBe('gone');
    await service.revokeShare(share.id);
    expect(await fetchSharedNote(share.token, stranger)).toBe('gone');
  });

  it('throws on anything else, such as the rate limit', async () => {
    const limited: typeof fetch = async () =>
      new Response(null, { status: 429, statusText: 'Too Many Requests' });
    await expect(fetchSharedNote('t', limited)).rejects.toMatchObject({ status: 429 });
  });
});
