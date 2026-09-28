import { beforeEach, describe, expect, it } from 'vitest';
import { type AttachmentMeta, noteTagId } from '@/contract/index.ts';
import type { Attachment, Note } from '@/models.ts';
import type { LocalStore } from './LocalStore.ts';
import type { Live } from './live.ts';
import { attachment, link, note, syncAll, tag } from './localStore.sync.contract.ts';
import type { ServerChanges } from './Remote.ts';

const none: ServerChanges = { notes: [], tags: [], noteTags: [], tombstones: [] };
const T1 = '2026-02-01T00:00:00.000Z';

/** A Note as a page carries it: its Revision and its Attachment metadata. */
const fromServer = (n: Note, rev: number) => ({
  ...n,
  rev,
  attachments: [] as AttachmentMeta[],
});

/**
 * Which bytes a row has, rather than the Blobs themselves: jsdom's Blob does not
 * survive fake-indexeddb's structured clone (see `dexie/attachments.roundtrip.test.ts`).
 */
const bytes = (a: Attachment | undefined) =>
  a && { ...a, blob: a.blob && 'blob', thumbnail: a.thumbnail && 'thumbnail' };

/** An Attachment as it rides on a Note: no bytes. */
function wireMeta(a: Attachment): AttachmentMeta {
  const meta: Partial<Attachment> = { ...a };
  delete meta.blob;
  delete meta.thumbnail;
  return meta as AttachmentMeta;
}

function latest<T>(live: Live<T>) {
  const values: T[] = [];
  const stop = live.subscribe((v) => values.push(v));
  return { stop, value: () => values[values.length - 1] };
}

async function until(check: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Writing what the server answers (M5 slice 4): pulled pages, resolved
 * outcomes, a full resync and adopting a library. Run from `describeLocalStoreContract`.
 */
export function describeLocalStorePullContract(makeStore: () => Promise<LocalStore>) {
  describe('LocalStore pull contract', () => {
    let store: LocalStore;
    beforeEach(async () => {
      store = await makeStore();
    });

    it('a page writes server rows with their Revision, not owed', async () => {
      const n = note();
      const t = tag();
      await store.sync.applyPage({
        ...none,
        notes: [fromServer(n, 4)],
        tags: [{ ...t, rev: 2 }],
        noteTags: [{ ...link(n.id, t.id), rev: 1 }],
      });

      expect(await store.notes.get(n.id)).toEqual(n);
      expect(await store.tags.get(t.id)).toEqual(t);
      expect(await store.tags.listLinks()).toEqual([link(n.id, t.id)]);
      expect(await store.sync.dirty()).toEqual(none);
      // The Revision is kept: the next local edit reports it.
      await store.notes.update(n.id, () => ({ header: 'edited' }));
      expect((await store.sync.dirty()).notes[0]?.rev).toBe(4);
    });

    it('a pull leaves an owed row and a pending purge for the push to decide', async () => {
      const edited = note();
      const purged = note();
      await store.notes.add(edited);
      await store.notes.add(purged);
      await syncAll(store, 1);
      await store.notes.update(edited.id, () => ({ header: 'mine' }));
      await store.notes.purge(purged.id);

      await store.sync.applyPage({
        ...none,
        notes: [fromServer({ ...edited, header: 'theirs' }, 2), fromServer(purged, 2)],
      });
      expect((await store.notes.get(edited.id))?.header).toBe('mine');
      expect(await store.notes.get(purged.id)).toBeUndefined();
      const owed = await store.sync.dirty();
      expect(owed.notes.map((n) => [n.header, n.rev])).toEqual([['mine', 1]]);
      expect(owed.tombstones.map((t) => [t.id, t.rev])).toEqual([[purged.id, 1]]);
    });

    it('server-wins overwrites an owed row and takes back a pending purge', async () => {
      const edited = note();
      const purged = note();
      await store.notes.add(edited);
      await store.notes.add(purged);
      await syncAll(store, 1);
      await store.notes.update(edited.id, () => ({ header: 'mine' }));
      await store.notes.purge(purged.id);

      await store.sync.applyPage(
        {
          ...none,
          notes: [fromServer({ ...edited, header: 'theirs' }, 2), fromServer(purged, 3)],
        },
        'server-wins'
      );
      expect((await store.notes.get(edited.id))?.header).toBe('theirs');
      expect(await store.notes.get(purged.id)).toEqual(purged);
      expect(await store.sync.dirty()).toEqual(none);
    });

    it('a server Tombstone removes the row and what hangs off it, leaving no local Tombstone', async () => {
      const n = note();
      const other = note();
      const t = tag();
      const kept = tag();
      await store.notes.add(n);
      await store.notes.add(other);
      await store.tags.add(t);
      await store.tags.add(kept);
      await store.tags.link(link(n.id, kept.id));
      await store.tags.link(link(other.id, t.id));
      await store.tags.link(link(other.id, kept.id));
      await store.attachments.add(attachment(n.id));
      await syncAll(store, 1);

      await store.sync.applyPage({
        ...none,
        tombstones: [
          { id: n.id, kind: 'note', deletedAt: T1 },
          { id: t.id, kind: 'tag', deletedAt: T1 },
          { id: noteTagId(other.id, kept.id), kind: 'noteTag', deletedAt: T1 },
        ],
      });
      expect(await store.notes.get(n.id)).toBeUndefined();
      expect(await store.attachments.list()).toEqual([]);
      expect(await store.tags.list()).toEqual([kept]);
      expect(await store.tags.listLinks()).toEqual([]);
      expect(await store.sync.dirty()).toEqual(none);
    });

    it("a pulled Note's attachments become rows without bytes", async () => {
      const n = note();
      const meta = { ...wireMeta(attachment(n.id)), name: 'cat.png', size: 3 };
      await store.sync.applyPage({
        ...none,
        notes: [{ ...fromServer(n, 1), attachments: [meta] }],
      });

      expect(await store.notes.get(n.id)).toEqual(n);
      expect(await store.attachments.list()).toEqual([meta]);
      expect(await store.sync.dirty()).toEqual(none);
    });

    it('a known row takes the metadata and keeps its bytes; an unlisted one is removed', async () => {
      const n = note();
      await store.notes.add(n);
      const kept = attachment(n.id);
      const dropped = attachment(n.id);
      await store.attachments.add(kept);
      await store.attachments.add(dropped);
      await syncAll(store, 1);

      const renamed = { ...wireMeta(kept), name: 'renamed.png' };
      await store.sync.applyPage({
        ...none,
        notes: [{ ...fromServer(n, 2), attachments: [renamed] }],
      });
      expect((await store.attachments.list()).map(bytes)).toEqual([
        { ...renamed, blob: 'blob', thumbnail: 'thumbnail' },
      ]);

      // A new thumbnailId names other bytes: the old thumbnail goes, the blob stays.
      const reposted = { ...renamed, thumbnailId: crypto.randomUUID() };
      await store.sync.applyPage({
        ...none,
        notes: [{ ...fromServer(n, 3), attachments: [reposted] }],
      });
      expect(bytes(await store.attachments.get(kept.id))).toEqual({ ...reposted, blob: 'blob' });
    });

    it('an owed Note keeps its rows through a pull; a Note without the array leaves them', async () => {
      const n = note();
      await store.notes.add(n);
      const a = attachment(n.id);
      await store.attachments.add(a);
      await syncAll(store, 1);
      await store.notes.update(n.id, () => ({ header: 'mine' }));

      await store.sync.applyPage({ ...none, notes: [{ ...fromServer(n, 2), attachments: [] }] });
      expect((await store.attachments.list()).map(bytes)).toEqual([bytes(a)]);

      await syncAll(store, 2);
      const bare: Partial<ReturnType<typeof fromServer>> = fromServer(n, 3);
      delete bare.attachments;
      await store.sync.applyPage({ ...none, notes: [bare as ReturnType<typeof fromServer>] });
      expect((await store.attachments.list()).map(bytes)).toEqual([bytes(a)]);
    });

    it('transfer state: which blobs the server holds, too large, received bytes', async () => {
      const n = note();
      await store.notes.add(n);
      const pushed = attachment(n.id);
      await store.attachments.add(pushed);
      await syncAll(store, 1);
      const unsynced = note();
      await store.notes.add(unsynced);
      const draft = attachment(unsynced.id);
      await store.attachments.add(draft);
      const meta = wireMeta(attachment(n.id));
      await store.sync.applyPage({
        ...none,
        notes: [{ ...fromServer(n, 2), attachments: [wireMeta(pushed), meta] }],
      });
      const owedBefore = await store.sync.dirty();

      await store.sync.onServer(pushed.id, pushed.thumbnailId!);
      await store.sync.onServer(pushed.id, pushed.id);
      await store.sync.tooLarge(draft.id);
      const blob = new Blob(['full']);
      const thumbnail = new Blob(['small']);
      await store.sync.received(meta.id, { blob, thumbnail });
      await store.sync.received('gone', { blob });

      const byId = new Map((await store.sync.transfers()).map((t) => [t.attachment.id, t]));
      expect({
        ...byId.get(pushed.id),
        attachment: bytes(byId.get(pushed.id)?.attachment),
      }).toEqual({
        attachment: bytes(pushed),
        noteOnServer: true,
        onServer: [pushed.thumbnailId, pushed.id],
        tooLarge: false,
      });
      expect(byId.get(draft.id)).toMatchObject({ noteOnServer: false, tooLarge: true });
      expect(bytes(byId.get(meta.id)?.attachment)).toEqual(bytes({ ...meta, blob, thumbnail }));
      expect(byId.get(meta.id)?.onServer).toEqual([meta.id, meta.thumbnailId]);
      // None of it is the server's business, and no read shows it.
      expect(await store.sync.dirty()).toEqual(owedBefore);
      expect(bytes(await store.attachments.get(pushed.id))).toEqual(bytes(pushed));
      expect(bytes(await store.attachments.get(draft.id))).toEqual(bytes(draft));
      // A clone of a row the server holds starts from nothing.
      const clone = { ...(await store.attachments.get(pushed.id))!, id: crypto.randomUUID() };
      await store.attachments.add(clone);
      expect(
        (await store.sync.transfers()).find((t) => t.attachment.id === clone.id)?.onServer
      ).toEqual([]);
    });

    it('resetClean keeps only what is owed, the Tombstones and every Attachment', async () => {
      const clean = note();
      const owed = note();
      const purged = note();
      await store.notes.add(clean);
      await store.notes.add(owed);
      await store.notes.add(purged);
      const bytes = attachment(clean.id);
      await store.attachments.add(bytes);
      await syncAll(store, 1);
      await store.notes.update(owed.id, () => ({ header: 'owed' }));
      await store.notes.purge(purged.id);

      await store.sync.resetClean();
      expect((await store.notes.list()).map((n) => n.id)).toEqual([owed.id]);
      expect((await store.attachments.list()).map((a) => a.id)).toEqual([bytes.id]);
      expect((await store.sync.dirty()).tombstones.map((t) => t.id)).toEqual([purged.id]);
    });

    it('adoptAll owes everything without a Revision and drops pending Tombstones', async () => {
      const n = note();
      const t = tag();
      const purged = note();
      await store.notes.add(n);
      await store.tags.add(t);
      await store.notes.add(purged);
      await syncAll(store, 5);
      await store.notes.purge(purged.id);

      await store.sync.adoptAll();
      const owed = await store.sync.dirty();
      expect(owed.notes.map((row) => [row.id, row.rev])).toEqual([[n.id, undefined]]);
      expect(owed.tags.map((row) => [row.id, row.rev])).toEqual([[t.id, undefined]]);
      expect(owed.tombstones).toEqual([]);
    });

    it('pending counts owed rows and Tombstones, live', async () => {
      const count = latest(store.sync.pending());
      await until(() => count.value() === 0);

      const n = note();
      await store.notes.add(n);
      await store.tags.add(tag());
      await until(() => count.value() === 2);
      await syncAll(store, 1);
      await until(() => count.value() === 0);
      await store.notes.purge(n.id);
      await until(() => count.value() === 1);
      count.stop();
    });
  });
}
