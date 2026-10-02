import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';
import type { LocalStore } from './LocalStore.ts';
import type { Live } from './live.ts';
import { describeLocalStorePullContract } from './localStore.pull.contract.ts';
import { describeLocalStoreSyncContract } from './localStore.sync.contract.ts';

const T0 = '2026-01-01T00:00:00.000Z';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    header: 'h',
    description: '',
    body: '',
    state: 'active',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function tag(overrides: Partial<Tag> = {}): Tag {
  return { id: crypto.randomUUID(), name: 'Work', createdAt: T0, updatedAt: T0, ...overrides };
}

function link(noteId: string, tagId: string): NoteTag {
  return { noteId, tagId, createdAt: T0, updatedAt: T0 };
}

function attachment(noteId: string, overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: crypto.randomUUID(),
    noteId,
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x']),
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function collect<T>(live: Live<T>) {
  const values: T[] = [];
  const unsubscribe = live.subscribe((value) => values.push(value));
  return { values, unsubscribe, latest: () => values[values.length - 1] };
}

/** Polls until `predicate` holds; a Live delivers asynchronously in every implementation. */
async function until(predicate: () => boolean, label = 'condition') {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

/**
 * The behaviour every Local Store must have. Run it from one test file per
 * implementation: `describeLocalStoreContract(() => makeFreshStore())`.
 * `makeStore` must return an *empty* store each time.
 */
export function describeLocalStoreContract(makeStore: () => Promise<LocalStore>) {
  describeLocalStoreSyncContract(makeStore);
  describeLocalStorePullContract(makeStore);

  describe('LocalStore contract', () => {
    let store: LocalStore;
    beforeEach(async () => {
      store = await makeStore();
    });
    afterEach(async () => {
      await store.clear();
    });

    describe('notes', () => {
      it('add / get / list / put', async () => {
        const n = note();
        await store.notes.add(n);
        expect(await store.notes.get(n.id)).toEqual(n);
        await store.notes.put({ ...n, header: 'changed' });
        expect((await store.notes.get(n.id))?.header).toBe('changed');
        expect(await store.notes.list()).toHaveLength(1);
        expect(await store.notes.get('missing')).toBeUndefined();
      });

      it('add rejects a duplicate id', async () => {
        const n = note();
        await store.notes.add(n);
        await expect(store.notes.add(n)).rejects.toThrow();
      });

      it('listByState and listTrashedBefore use the fields, not the caller', async () => {
        const active = note();
        const old = note({ state: 'trashed', trashedAt: '2025-01-01T00:00:00.000Z' });
        const recent = note({ state: 'trashed', trashedAt: '2026-06-01T00:00:00.000Z' });
        for (const n of [active, old, recent]) await store.notes.add(n);
        expect(ids(await store.notes.listByState('trashed'))).toEqual(ids([old, recent]));
        expect(ids(await store.notes.listTrashedBefore('2026-01-01T00:00:00.000Z'))).toEqual([
          old.id,
        ]);
      });

      it('update is a read-modify-write that reports before and after, and null when gone', async () => {
        const n = note({ header: 'a' });
        await store.notes.add(n);
        const result = await store.notes.update(n.id, (current) => ({
          header: `${current.header}b`,
        }));
        expect(result?.before.header).toBe('a');
        expect(result?.after.header).toBe('ab');
        expect((await store.notes.get(n.id))?.header).toBe('ab');
        expect(await store.notes.update('missing', () => ({}))).toBeNull();
      });

      it('update can clear an optional field', async () => {
        const n = note({ pinnedAt: T0 });
        await store.notes.add(n);
        await store.notes.update(n.id, () => ({ pinnedAt: undefined }));
        expect((await store.notes.get(n.id))?.pinnedAt).toBeUndefined();
      });

      it('purge removes links and attachments and returns them; restore puts everything back', async () => {
        const n = note();
        const t = tag();
        const a = attachment(n.id);
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.attachments.add(a);

        const removed = await store.notes.purge(n.id);
        expect(removed.removedTags.map((l) => l.tagId)).toEqual([t.id]);
        expect(ids(removed.removedAttachments)).toEqual([a.id]);
        expect(await store.notes.get(n.id)).toBeUndefined();
        expect(await store.attachments.get(a.id)).toBeUndefined();
        expect(await store.tags.listLinks()).toEqual([]);
        expect(await store.tags.get(t.id)).toEqual(t); // the tag itself survives

        await store.notes.restore(n, removed);
        expect(await store.notes.get(n.id)).toEqual(n);
        expect(await store.tags.listLinks()).toHaveLength(1);
        expect(await store.attachments.get(a.id)).toBeDefined();
      });

      it('feed is live, scoped by state and tag, and joins tags on', async () => {
        const t = tag({ name: 'Work' });
        const inTag = note({ header: 'in' });
        const outOfTag = note({ header: 'out' });
        const archived = note({ state: 'archived' });
        await store.tags.add(t);
        for (const n of [inTag, outOfTag, archived]) await store.notes.add(n);
        await store.tags.link(link(inTag.id, t.id));

        const active = collect(store.notes.feed({ state: 'active' }));
        await until(() => active.values.length >= 1, 'first feed value');
        expect(ids(active.latest())).toEqual(ids([inTag, outOfTag]));
        expect(active.latest().find((n) => n.id === inTag.id)?.tags).toEqual([t]);
        expect(active.latest().find((n) => n.id === outOfTag.id)?.tags).toEqual([]);

        const scoped = collect(store.notes.feed({ state: 'active', tagId: t.id }));
        await until(() => scoped.values.length >= 1, 'scoped feed value');
        expect(ids(scoped.latest())).toEqual([inTag.id]);

        const added = note({ header: 'new' });
        await store.notes.add(added);
        await until(() => active.latest().some((n) => n.id === added.id), 'feed to see the add');

        await store.tags.link(link(added.id, t.id));
        await until(
          () => scoped.latest().some((n) => n.id === added.id),
          'scoped feed to see the link'
        );

        active.unsubscribe();
        scoped.unsubscribe();
      });
    });

    describe('tags', () => {
      it('findByName ignores case and surrounding whitespace', async () => {
        const t = tag({ name: 'Work' });
        await store.tags.add(t);
        expect(await store.tags.findByName('work')).toEqual(t);
        expect(await store.tags.findByName('  WORK ')).toEqual(t);
        expect(await store.tags.findByName('wor')).toBeUndefined();
      });

      it('link is idempotent and unlink removes exactly one link', async () => {
        const n = note();
        const t1 = tag({ name: 'a' });
        const t2 = tag({ name: 'b' });
        await store.notes.add(n);
        await store.tags.add(t1);
        await store.tags.add(t2);
        const first = link(n.id, t1.id);
        await store.tags.link(first);
        await store.tags.link({ ...first, createdAt: 'later' });
        await store.tags.link(link(n.id, t2.id));
        const links = await store.tags.listLinks();
        expect(links).toHaveLength(2);
        expect(links.find((l) => l.tagId === t1.id)?.createdAt).toBe(T0); // the first write won
        await store.tags.unlink(n.id, t1.id);
        expect((await store.tags.listLinks()).map((l) => l.tagId)).toEqual([t2.id]);
      });

      it('delete cascades to links', async () => {
        const n = note();
        const t = tag();
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.tags.delete(t.id);
        expect(await store.tags.get(t.id)).toBeUndefined();
        expect(await store.tags.listLinks()).toEqual([]);
      });

      it('merge relabels, dedupes notes carrying both, deletes the source, and refuses a missing target', async () => {
        const both = note();
        const onlySource = note();
        const source = tag({ name: 'src' });
        const target = tag({ name: 'dst' });
        for (const n of [both, onlySource]) await store.notes.add(n);
        await store.tags.add(source);
        await store.tags.add(target);
        await store.tags.link(link(both.id, source.id));
        await store.tags.link(link(both.id, target.id));
        await store.tags.link(link(onlySource.id, source.id));

        await store.tags.merge(source.id, target.id);

        const links = await store.tags.listLinks();
        expect(links.every((l) => l.tagId === target.id)).toBe(true);
        expect(links.map((l) => l.noteId).sort()).toEqual([both.id, onlySource.id].sort());
        expect(await store.tags.get(source.id)).toBeUndefined();

        await expect(store.tags.merge(target.id, 'missing')).rejects.toThrow();
        // a rejected merge must not have relabelled anything: target.id is
        // the source of this second, failing merge and must survive intact
        expect(await store.tags.get(target.id)).toEqual(target);
        expect(await store.tags.listLinks()).toHaveLength(2);
      });

      it('merge with the same source and target changes nothing', async () => {
        const n = note();
        const t = tag();
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));

        await store.tags.merge(t.id, t.id);

        expect(await store.tags.get(t.id)).toEqual(t);
        expect(await store.tags.listLinks()).toHaveLength(1);
      });

      it('all, watch and forNote are live', async () => {
        const n = note();
        await store.notes.add(n);
        const all = collect(store.tags.all());
        const one = tag({ name: 'x' });
        const watched = collect(store.tags.watch(one.id));
        const forNote = collect(store.tags.forNote(n.id));
        await until(
          () => all.values.length >= 1 && watched.values.length >= 1 && forNote.values.length >= 1
        );
        expect(all.latest()).toEqual([]);
        expect(watched.latest()).toBeUndefined();
        expect(forNote.latest()).toEqual([]);

        await store.tags.add(one);
        await until(() => all.latest().length === 1, 'all to see the add');
        await until(() => watched.latest()?.id === one.id, 'watch to see the add');

        await store.tags.link(link(n.id, one.id));
        await until(() => forNote.latest().length === 1, 'forNote to see the link');

        await store.tags.put({ ...one, name: 'renamed' });
        await until(() => watched.latest()?.name === 'renamed', 'watch to see the rename');
        await until(() => forNote.latest()[0]?.name === 'renamed', 'forNote to see the rename');

        all.unsubscribe();
        watched.unsubscribe();
        forNote.unsubscribe();
      });
    });

    describe('attachments', () => {
      it('add / get / update / delete', async () => {
        const n = note();
        const a = attachment(n.id);
        await store.notes.add(n);
        await store.attachments.add(a);
        expect((await store.attachments.get(a.id))?.id).toBe(a.id);
        await store.attachments.update(a.id, {
          duration: 12,
          updatedAt: '2026-02-02T00:00:00.000Z',
        });
        const row = await store.attachments.get(a.id);
        expect(row?.duration).toBe(12);
        expect(row?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
        await store.attachments.delete(a.id);
        expect(await store.attachments.get(a.id)).toBeUndefined();
      });

      it('forNote, forNotes and watch are live', async () => {
        const n1 = note();
        const n2 = note();
        await store.notes.add(n1);
        await store.notes.add(n2);
        const a1 = attachment(n1.id);
        const forNote = collect(store.attachments.forNote(n1.id));
        const forNotes = collect(store.attachments.forNotes([n1.id, n2.id]));
        const watched = collect(store.attachments.watch(a1.id));
        await until(
          () =>
            forNote.values.length >= 1 && forNotes.values.length >= 1 && watched.values.length >= 1
        );

        await store.attachments.add(a1);
        await until(() => forNote.latest().length === 1, 'forNote');
        await until(() => watched.latest()?.id === a1.id, 'watch');
        await store.attachments.add(attachment(n2.id));
        await until(() => forNotes.latest().length === 2, 'forNotes');
        expect(forNote.latest()).toHaveLength(1);

        await store.attachments.update(a1.id, {
          duration: 7,
          updatedAt: '2026-03-03T00:00:00.000Z',
        });
        await until(() => forNote.latest()[0]?.duration === 7, 'forNote to see the update');
        await until(
          () => forNotes.latest().find((a) => a.id === a1.id)?.duration === 7,
          'forNotes to see the update'
        );
        await until(() => watched.latest()?.duration === 7, 'watch to see the update');

        forNote.unsubscribe();
        forNotes.unsubscribe();
        watched.unsubscribe();
      });

      it('forNotes with no ids delivers an empty list and never throws', async () => {
        const empty = collect(store.attachments.forNotes([]));
        await until(() => empty.values.length >= 1);
        expect(empty.latest()).toEqual([]);
        empty.unsubscribe();
      });

      it('sweepNote keeps only the listed ids of that note', async () => {
        const n = note();
        const other = note();
        await store.notes.add(n);
        await store.notes.add(other);
        const keep = attachment(n.id);
        const drop = attachment(n.id);
        const elsewhere = attachment(other.id);
        for (const a of [keep, drop, elsewhere]) await store.attachments.add(a);
        expect(await store.attachments.sweepNote(n.id, [keep.id])).toBe(1);
        expect(ids(await store.attachments.list())).toEqual(ids([keep, elsewhere]));
      });

      it('sweepAll drops rows with no owner and rows the owner no longer references', async () => {
        const owner = note({ body: 'ref:KEEP' });
        await store.notes.add(owner);
        const referenced = attachment(owner.id, { id: 'KEEP' });
        const unreferenced = attachment(owner.id);
        const orphan = attachment('no-such-note');
        for (const a of [referenced, unreferenced, orphan]) await store.attachments.add(a);
        const count = await store.attachments.sweepAll((n) =>
          n.body?.includes('ref:KEEP') ? ['KEEP'] : []
        );
        expect(count).toBe(2);
        expect(ids(await store.attachments.list())).toEqual(['KEEP']);
      });
    });

    describe('meta', () => {
      it('get / set / delete round-trip any JSON value', async () => {
        expect(await store.meta.get('k')).toBeUndefined();
        await store.meta.set('k', { a: [1, 2] });
        expect(await store.meta.get('k')).toEqual({ a: [1, 2] });
        await store.meta.set('k', 'replaced');
        expect(await store.meta.get('k')).toBe('replaced');
        await store.meta.delete('k');
        expect(await store.meta.get('k')).toBeUndefined();
      });
    });

    describe('whole store', () => {
      it('exportAll / replaceAll round-trip the four data stores and leave meta alone', async () => {
        const n = note();
        const t = tag();
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.attachments.add(attachment(n.id));
        await store.meta.set('cursor', 'abc');

        const snapshot = await store.exportAll();
        expect(snapshot.notes).toHaveLength(1);
        expect(snapshot.tags).toHaveLength(1);
        expect(snapshot.noteTags).toHaveLength(1);
        expect(snapshot.attachments).toHaveLength(1);

        const replacement = note({ header: 'only me' });
        await store.replaceAll({ notes: [replacement], tags: [], noteTags: [], attachments: [] });
        expect(ids(await store.notes.list())).toEqual([replacement.id]);
        expect(await store.tags.list()).toEqual([]);
        expect(await store.tags.listLinks()).toEqual([]);
        expect(await store.attachments.list()).toEqual([]);
        expect(await store.meta.get('cursor')).toBe('abc');

        await store.replaceAll(snapshot);
        expect(ids(await store.notes.list())).toEqual([n.id]);
      });

      it('clear empties everything, meta included', async () => {
        await store.notes.add(note());
        await store.meta.set('k', 1);
        await store.clear();
        expect(await store.notes.list()).toEqual([]);
        expect(await store.meta.get('k')).toBeUndefined();
      });
    });
  });
}
