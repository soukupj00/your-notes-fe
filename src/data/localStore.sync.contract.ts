import { beforeEach, describe, expect, it } from 'vitest';
import { noteTagId } from '@/contract/index.ts';
import type { Attachment, Note, Tag } from '@/models.ts';
import type { LocalStore } from './LocalStore.ts';
import type { PushBatch, PushOutcome } from './Remote.ts';

const T0 = '2026-01-01T00:00:00.000Z';

export const note = (overrides: Partial<Note> = {}): Note => ({
  id: crypto.randomUUID(),
  header: 'h',
  state: 'active',
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

export const tag = (): Tag => ({
  id: crypto.randomUUID(),
  name: 'Work',
  createdAt: T0,
  updatedAt: T0,
});

export const link = (noteId: string, tagId: string) => ({
  noteId,
  tagId,
  createdAt: T0,
  updatedAt: T0,
});

export const attachment = (noteId: string): Attachment => ({
  id: crypto.randomUUID(),
  noteId,
  kind: 'image',
  mime: 'image/png',
  blob: new Blob(['x']),
  thumbnail: new Blob(['t']),
  createdAt: T0,
  updatedAt: T0,
});

/** What a server accepting every row of `batch` at Revision `rev` answers. */
function acceptAll(batch: PushBatch, rev: number): PushOutcome[] {
  return [
    ...batch.notes.map((n) => ({ kind: 'note' as const, id: n.id })),
    ...batch.tags.map((t) => ({ kind: 'tag' as const, id: t.id })),
    ...batch.noteTags.map((l) => ({ kind: 'noteTag' as const, id: noteTagId(l.noteId, l.tagId) })),
    ...batch.tombstones.map((t) => ({ kind: t.kind, id: t.id })),
  ].map((row) => ({ ...row, status: 'accepted' as const, rev }));
}

/** Push everything owed and have it all accepted at `rev`. */
export async function syncAll(store: LocalStore, rev = 1) {
  const batch = await store.sync.dirty();
  await store.sync.applied(batch, acceptAll(batch, rev));
}

/**
 * The sync half of the contract (M5 slice 3): what every write owes the server,
 * and that the Revision never leaves the store. Run from `describeLocalStoreContract`.
 */
export function describeLocalStoreSyncContract(makeStore: () => Promise<LocalStore>) {
  describe('LocalStore sync contract', () => {
    let store: LocalStore;
    beforeEach(async () => {
      store = await makeStore();
    });

    it('owes every new row in wire shape, and no read shows sync state', async () => {
      const n = note({ tags: [tag()] });
      const t = tag();
      await store.notes.add(n);
      await store.tags.add(t);
      await store.tags.link(link(n.id, t.id));

      const batch = await store.sync.dirty();
      expect(batch.notes).toEqual([{ ...note({ id: n.id }), attachments: [] }]);
      expect(batch.tags).toEqual([t]);
      expect(batch.noteTags).toEqual([link(n.id, t.id)]);
      expect(batch.tombstones).toEqual([]);

      await syncAll(store);
      expect(await store.notes.get(n.id)).toEqual(n);
      expect(await store.tags.get(t.id)).toEqual(t);
      expect(await store.tags.listLinks()).toEqual([link(n.id, t.id)]);
      expect((await store.exportAll()).notes).toEqual([n]);
    });

    it('applied records the Revision and clears what it covers', async () => {
      const n = note();
      await store.notes.add(n);
      await syncAll(store, 3);
      expect(await store.sync.dirty()).toEqual({
        notes: [],
        tags: [],
        noteTags: [],
        tombstones: [],
      });

      await store.notes.update(n.id, () => ({ header: 'edited' }));
      expect((await store.sync.dirty()).notes).toEqual([
        { ...n, header: 'edited', rev: 3, attachments: [] },
      ]);
    });

    it('keeps the Revision when a caller puts a row without one', async () => {
      const n = note();
      const t = tag();
      await store.notes.add(n);
      await store.tags.add(t);
      await syncAll(store, 2);

      await store.notes.put({ ...n, header: 'put' });
      await store.tags.put({ ...t, name: 'Home' });
      const batch = await store.sync.dirty();
      expect(batch.notes[0]?.rev).toBe(2);
      expect(batch.tags[0]?.rev).toBe(2);
    });

    it('an edit made while the push was in flight stays owed, at the new Revision', async () => {
      const n = note();
      await store.notes.add(n);
      const batch = await store.sync.dirty();
      await store.notes.update(n.id, () => ({ header: 'typed during push' }));
      await store.sync.applied(batch, acceptAll(batch, 1));

      expect((await store.sync.dirty()).notes).toEqual([
        { ...n, header: 'typed during push', rev: 1, attachments: [] },
      ]);
    });

    it('an Attachment write owes its Note, carrying metadata and never bytes', async () => {
      const n = note();
      await store.notes.add(n);
      await syncAll(store);
      const a = attachment(n.id);
      await store.attachments.add(a);

      const [wire] = (await store.sync.dirty()).notes;
      const meta: Partial<Attachment> = { ...a };
      delete meta.blob;
      delete meta.thumbnail;
      expect(wire).toEqual({ ...n, rev: 1, attachments: [meta] });

      await syncAll(store, 2);
      await store.attachments.update(a.id, { preview: '<svg/>' });
      expect((await store.sync.dirty()).notes).toHaveLength(1);
      await syncAll(store, 3);
      await store.attachments.sweepNote(n.id, []);
      expect((await store.sync.dirty()).notes[0]?.attachments).toEqual([]);
    });

    it('purge leaves one Tombstone with the Revision; restore takes it back', async () => {
      const n = note();
      const t = tag();
      await store.notes.add(n);
      await store.tags.add(t);
      await store.tags.link(link(n.id, t.id));
      await syncAll(store, 4);

      const removed = await store.notes.purge(n.id);
      const afterPurge = await store.sync.dirty();
      expect(afterPurge.notes).toEqual([]);
      expect(afterPurge.tombstones).toEqual([
        { id: n.id, kind: 'note', rev: 4, deletedAt: expect.any(String) },
      ]);

      await store.notes.restore(n, removed);
      const afterRestore = await store.sync.dirty();
      expect(afterRestore.tombstones).toEqual([]);
      expect(afterRestore.notes[0]?.rev).toBe(4);
      expect(afterRestore.noteTags).toEqual([link(n.id, t.id)]);
    });

    it('removing something never pushed leaves nothing to tell the server', async () => {
      const t = tag();
      const n = note();
      await store.tags.add(t);
      await store.notes.add(n);
      await store.tags.link(link(n.id, t.id));
      await store.tags.unlink(n.id, t.id);
      await store.tags.delete(t.id);
      await store.notes.purge(n.id);
      expect(await store.sync.dirty()).toEqual({
        notes: [],
        tags: [],
        noteTags: [],
        tombstones: [],
      });
    });

    it('unlink leaves a NoteTag Tombstone under the composite id; link takes it back', async () => {
      const n = note();
      const t = tag();
      await store.notes.add(n);
      await store.tags.add(t);
      await store.tags.link(link(n.id, t.id));
      await syncAll(store, 1);

      await store.tags.unlink(n.id, t.id);
      expect((await store.sync.dirty()).tombstones).toEqual([
        { id: noteTagId(n.id, t.id), kind: 'noteTag', rev: 1, deletedAt: expect.any(String) },
      ]);
      await store.tags.unlink(n.id, t.id);
      expect((await store.sync.dirty()).tombstones).toHaveLength(1);

      await store.tags.link(link(n.id, t.id));
      const batch = await store.sync.dirty();
      expect(batch.tombstones).toEqual([]);
      expect(batch.noteTags).toEqual([{ ...link(n.id, t.id), rev: 1 }]);
    });

    it('merge owes the new links and tombstones the source Tag only', async () => {
      const n = note();
      const source = tag();
      const target = tag();
      await store.notes.add(n);
      await store.tags.add(source);
      await store.tags.add(target);
      await store.tags.link(link(n.id, source.id));
      await syncAll(store, 2);

      await store.tags.merge(source.id, target.id);
      const batch = await store.sync.dirty();
      expect(batch.noteTags.map((l) => l.tagId)).toEqual([target.id]);
      expect(batch.tombstones).toEqual([
        { id: source.id, kind: 'tag', rev: 2, deletedAt: expect.any(String) },
      ]);
    });

    it('an accepted Tombstone is dropped; one written mid-push takes the new Revision', async () => {
      const a = note();
      const b = note();
      await store.notes.add(a);
      await store.notes.add(b);
      await syncAll(store, 1);
      await store.notes.purge(a.id);
      await syncAll(store, 2);
      expect((await store.sync.dirty()).tombstones).toEqual([]);

      await store.notes.update(b.id, () => ({ header: 'x' }));
      const batch = await store.sync.dirty();
      await store.notes.purge(b.id);
      await store.sync.applied(batch, acceptAll(batch, 5));
      expect((await store.sync.dirty()).tombstones).toEqual([
        { id: b.id, kind: 'note', rev: 5, deletedAt: expect.any(String) },
      ]);
    });

    it('applied refuses outcomes that do not pair with the batch', async () => {
      await store.notes.add(note());
      const batch = await store.sync.dirty();
      await expect(store.sync.applied(batch, [])).rejects.toThrow();
      expect((await store.sync.dirty()).notes).toHaveLength(1);
    });

    it('replaceAll owes every row, keeps known Revisions, and drops pending Tombstones', async () => {
      const kept = note();
      const purged = note();
      await store.notes.add(kept);
      await store.notes.add(purged);
      await syncAll(store, 7);
      await store.notes.purge(purged.id);

      const fresh = note();
      await store.replaceAll({ notes: [kept, fresh], tags: [], noteTags: [], attachments: [] });
      const batch = await store.sync.dirty();
      expect(batch.tombstones).toEqual([]);
      expect(Object.fromEntries(batch.notes.map((n) => [n.id, n.rev]))).toEqual({
        [kept.id]: 7,
        [fresh.id]: undefined,
      });
    });

    it('clear drops Tombstones too', async () => {
      const n = note();
      await store.notes.add(n);
      await store.notes.purge(n.id);
      await store.clear();
      expect(await store.sync.dirty()).toEqual({
        notes: [],
        tags: [],
        noteTags: [],
        tombstones: [],
      });
    });
  });
}
