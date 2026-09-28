import { beforeEach, describe, expect, it } from 'vitest';
import { noteTagId } from '@/contract/index.ts';
import type { Note } from '@/models.ts';
import type { LocalStore } from './LocalStore.ts';
import type { Live } from './live.ts';
import { attachment, link, note, syncAll, tag } from './localStore.sync.contract.ts';
import type { ServerChanges } from './Remote.ts';

const none: ServerChanges = { notes: [], tags: [], noteTags: [], tombstones: [] };
const T1 = '2026-02-01T00:00:00.000Z';

/** A Note as a page carries it: its Revision and its Attachment metadata. */
const fromServer = (n: Note, rev: number) => ({ ...n, rev, attachments: [] });

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

    it('a Note from the server does not bring Attachment rows (slice 5)', async () => {
      const n = note();
      await store.sync.applyPage({
        ...none,
        notes: [
          {
            ...fromServer(n, 1),
            attachments: [
              {
                id: crypto.randomUUID(),
                noteId: n.id,
                kind: 'image',
                mime: 'image/png',
                createdAt: T1,
                updatedAt: T1,
              },
            ],
          },
        ],
      });
      expect(await store.notes.get(n.id)).toEqual(n);
      expect(await store.attachments.list()).toEqual([]);
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
