import { describe, expect, it } from 'vitest';
import { noteTagId } from '@/contract/index.ts';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalRemote } from '@/data/http/HalRemote.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { SYNC_META_KEYS } from '@/data/LocalStore.ts';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import type { Note, Tag } from '@/models.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { CONFLICTS_TAG_NAME } from './conflictedCopy.ts';
import { createSyncEngine } from './engine.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const note = (header: string, extra: Partial<Note> = {}): Note => ({
  id: crypto.randomUUID(),
  header,
  body: `<p>${header}</p>`,
  state: 'active',
  createdAt: T0,
  updatedAt: T0,
  ...extra,
});
const tag = (name: string): Tag => ({
  id: crypto.randomUUID(),
  name,
  createdAt: T0,
  updatedAt: T0,
});
const at = (n: number) => `2026-01-0${n}T00:00:00.000Z`;

function setup() {
  const server = createFakeServer();
  const owner = server.seedOwner('ada', 'correct horse');
  return { server, owner };
}

/** A signed-in Device: its own browser, store and engine, attached to the Owner's Account. */
async function device(server: FakeServer, accountId: string, name: string, batchSize?: number) {
  const client = server.client();
  const hal = createHalClient(client.fetch);
  await createHalAccountService(hal).signIn('ada', 'correct horse', name);
  const store = createMemoryLocalStore();
  const remote = { ...createHalRemote(hal), hints: client.hints };
  const engine = createSyncEngine({ store, remote, deviceName: () => name, batchSize });
  await engine.adopt(accountId);
  return { store, engine, remote };
}

const pendingOf = async (store: ReturnType<typeof createMemoryLocalStore>) => {
  const owed = await store.sync.dirty();
  return owed.notes.length + owed.tags.length + owed.noteTags.length + owed.tombstones.length;
};

describe('sync engine', () => {
  it('pushes new rows and the other Device pulls them, not owed', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Groceries');
    const t = tag('Home');
    await a.store.notes.add(n);
    await a.store.tags.add(t);
    await a.store.tags.link({ noteId: n.id, tagId: t.id, createdAt: T0, updatedAt: T0 });

    await a.engine.sync();
    expect(await pendingOf(a.store)).toBe(0);
    expect(server.sync.row(owner.id, 'note', n.id)?.rev).toBe(1);

    await b.engine.sync();
    expect(await b.store.notes.get(n.id)).toEqual(n);
    expect(await b.store.tags.listLinks()).toHaveLength(1);
    expect(await pendingOf(b.store)).toBe(0);
    expect(await b.store.meta.get(SYNC_META_KEYS.lastSyncedAt)).toEqual(expect.any(String));
  });

  it('an edit at the current Revision is accepted and reaches the other Device', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Draft');
    await a.store.notes.add(n);
    await a.engine.sync();
    await b.engine.sync();

    await b.store.notes.update(n.id, () => ({ header: 'Final', updatedAt: at(2) }));
    expect(await b.engine.sync()).toEqual({ conflicts: 0, keptNewer: 0 });
    await a.engine.sync();
    expect((await a.store.notes.get(n.id))?.header).toBe('Final');
    expect(server.sync.row(owner.id, 'note', n.id)?.rev).toBe(2);
  });

  it('a stale edit loses to the server and is kept as a tagged Conflicted Copy', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const work = tag('Work');
    const n = note('Plan', { color: 'teal' });
    await a.store.notes.add(n);
    await a.store.tags.add(work);
    await a.store.tags.link({ noteId: n.id, tagId: work.id, createdAt: T0, updatedAt: T0 });
    await a.engine.sync();
    await b.engine.sync();
    const drawing = crypto.randomUUID();
    await b.store.attachments.add({
      id: drawing,
      noteId: n.id,
      kind: 'image',
      mime: 'image/png',
      blob: new Blob(['png']),
      createdAt: T0,
      updatedAt: T0,
    });

    await a.store.notes.update(n.id, () => ({ body: "<p>A's text</p>", updatedAt: at(2) }));
    await a.engine.sync();
    const bBody = `<p>B's text</p><img data-attachment-id="${drawing}">`;
    await b.store.notes.update(n.id, () => ({ body: bBody, updatedAt: at(3) }));

    const report = await b.engine.sync();
    expect(report.conflicts).toBe(1);
    expect((await b.store.notes.get(n.id))?.body).toBe("<p>A's text</p>");

    const copy = (await b.store.notes.list()).find((x) => x.id !== n.id)!;
    expect(copy.header).toMatch(/^Plan \(conflict from Phone, \d{4}-\d{2}-\d{2}\)$/);
    expect(copy).toMatchObject({ state: 'active', color: 'teal' });
    const [clone] = (await b.store.attachments.list()).filter((x) => x.noteId === copy.id);
    expect(clone?.id).not.toBe(drawing);
    expect(copy.body).toBe(`<p>B's text</p><img data-attachment-id="${clone?.id}">`);
    const conflicts = await b.store.tags.findByName(CONFLICTS_TAG_NAME);
    expect(report.conflictsTagId).toBe(conflicts?.id);
    const copyTags = (await b.store.tags.listLinks())
      .filter((l) => l.noteId === copy.id)
      .map((l) => l.tagId);
    expect(copyTags.sort()).toEqual([work.id, conflicts!.id].sort());

    // The copy is owed, so the next run takes it (and the Conflicts Tag) to A.
    await b.engine.sync();
    await a.engine.sync();
    expect((await a.store.notes.get(copy.id))?.header).toBe(copy.header);
    expect(await a.store.tags.findByName(CONFLICTS_TAG_NAME)).toBeDefined();
  });

  it('a push the server already holds verbatim is not a conflict', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const n = note('Same everywhere');
    await a.store.notes.add(n);
    await a.engine.sync();

    // The same library, adopted again without its Revisions (another Account in between).
    await a.engine.adopt(crypto.randomUUID());
    await a.engine.adopt(owner.id);
    expect(await a.engine.sync()).toEqual({ conflicts: 0, keptNewer: 0 });
    expect(await a.store.notes.list()).toHaveLength(1);
    expect(await pendingOf(a.store)).toBe(0);
  });

  it('a Tag conflict takes the server name and copies nothing', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const t = tag('Hom');
    await a.store.tags.add(t);
    await a.engine.sync();
    await b.engine.sync();
    await a.store.tags.put({ ...t, name: 'Home' });
    await a.engine.sync();
    await b.store.tags.put({ ...t, name: 'House' });

    expect(await b.engine.sync()).toEqual({ conflicts: 0, keptNewer: 0 });
    expect(await b.store.tags.list()).toEqual([{ ...t, name: 'Home' }]);
  });

  it('a purge reaches the other Device through its Tombstone', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Old');
    await a.store.notes.add(n);
    await a.engine.sync();
    await b.engine.sync();

    await a.store.notes.purge(n.id);
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.store.notes.get(n.id)).toBeUndefined();
    expect(await pendingOf(a.store)).toBe(0);
    expect(await pendingOf(b.store)).toBe(0);
  });

  it('an edit to something purged elsewhere survives as a Conflicted Copy', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Doomed');
    await a.store.notes.add(n);
    await a.engine.sync();
    await b.engine.sync();
    await a.store.notes.purge(n.id);
    await a.engine.sync();

    await b.store.notes.update(n.id, () => ({ header: 'Edited', updatedAt: at(4) }));
    const report = await b.engine.sync();
    expect(report.conflicts).toBe(1);
    expect(await b.store.notes.get(n.id)).toBeUndefined();
    const [copy] = await b.store.notes.list();
    expect(copy?.header).toMatch(/^Edited \(conflict from Phone, \d{4}-\d{2}-\d{2}\)$/);
    // The copy is a new Note with nothing to delete on the server: it only waits to go up.
    expect((await b.store.sync.dirty()).tombstones).toEqual([]);
  });

  it('an edit made while a purge from elsewhere is being pulled survives as a copy', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Doomed');
    await a.store.notes.add(n);
    await a.engine.sync();
    await b.engine.sync();
    await a.store.notes.purge(n.id);
    await a.engine.sync();

    // B's push has nothing to send; the edit lands just before the page arrives.
    const pull = b.remote.pull;
    b.remote.pull = async (cursor) => {
      b.remote.pull = pull;
      await b.store.notes.update(n.id, () => ({ header: 'Typed just now', updatedAt: at(5) }));
      return pull(cursor);
    };
    const report = await b.engine.sync();
    expect(report.conflicts).toBe(1);
    expect(await b.store.notes.get(n.id)).toBeUndefined();
    expect((await b.store.notes.list()).map((x) => x.header)).toEqual([
      expect.stringMatching(/^Typed just now \(conflict from Phone/),
    ]);
  });

  it("never pushes the Tour's Props, nor anything about them", async () => {
    const { server, owner } = setup();
    const hal = createHalClient(server.client().fetch);
    await createHalAccountService(hal).signIn('ada', 'correct horse', 'Laptop');
    const store = createMemoryLocalStore();
    const prop = note('A Prop');
    const mine = note('Mine');
    const t = tag('Tag');
    await store.notes.add(prop);
    await store.notes.add(mine);
    await store.tags.add(t);
    await store.tags.link({ noteId: prop.id, tagId: t.id, createdAt: T0, updatedAt: T0 });
    const engine = createSyncEngine({
      store,
      remote: createHalRemote(hal),
      deviceName: () => 'Laptop',
      exclude: async () => new Set([prop.id]),
    });
    await engine.adopt(owner.id);

    await engine.sync();
    expect(server.sync.row(owner.id, 'note', prop.id)).toBeUndefined();
    expect(server.sync.row(owner.id, 'noteTag', noteTagId(prop.id, t.id))).toBeUndefined();
    expect(server.sync.row(owner.id, 'note', mine.id)).toBeDefined();
    // Purged unpushed, a Prop leaves no Tombstone to send either.
    await store.notes.purge(prop.id);
    expect((await store.sync.dirty()).tombstones).toEqual([]);
  });

  it('a stale purge keeps the newer edit, with its links', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const n = note('Keep me');
    const t = tag('Work');
    await a.store.notes.add(n);
    await a.store.tags.add(t);
    await a.store.tags.link({ noteId: n.id, tagId: t.id, createdAt: T0, updatedAt: T0 });
    await a.engine.sync();
    await b.engine.sync();
    await a.store.notes.update(n.id, () => ({ header: 'Kept', updatedAt: at(2) }));
    await a.engine.sync();

    await b.store.notes.purge(n.id);
    const report = await b.engine.sync();
    expect(report.keptNewer).toBe(1);
    expect((await b.store.notes.get(n.id))?.header).toBe('Kept');
    expect(await b.store.tags.listLinks()).toEqual([
      { noteId: n.id, tagId: t.id, createdAt: T0, updatedAt: T0 },
    ]);
    expect(await pendingOf(b.store)).toBe(0);
  });

  it('pages through the feed and keeps the resume link as the cursor', async () => {
    const { server, owner } = setup();
    server.sync.settings.pageSize = 2;
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    for (const header of ['1', '2', '3', '4', '5']) await a.store.notes.add(note(header));
    await a.engine.sync();

    await b.engine.sync();
    expect(await b.store.notes.list()).toHaveLength(5);
    expect(await b.store.meta.get(SYNC_META_KEYS.cursor)).toBe('/api/changes?since=5');
    expect(await b.store.meta.get(SYNC_META_KEYS.seq)).toBe(5);
  });

  it("a one-page library's next run pulls nothing it already has", async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    for (const header of ['1', '2']) await a.store.notes.add(note(header));
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.store.notes.list()).toHaveLength(2);

    const rows: number[] = [];
    const pull = b.remote.pull;
    b.remote.pull = async (cursor) => {
      const page = await pull(cursor);
      if (page.status === 'ok') rows.push(page.notes.length + page.tags.length);
      return page;
    };
    await b.engine.sync();
    expect(rows).toEqual([0]);
    expect(await b.store.meta.get(SYNC_META_KEYS.cursor)).toBe('/api/changes?since=2');
  });

  it('pushes in batches without sending a link ahead of its Note', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop', 2);
    const t = tag('Tag');
    const notes = [note('1'), note('2'), note('3')];
    for (const n of notes) await a.store.notes.add(n);
    await a.store.tags.add(t);
    for (const n of notes) {
      await a.store.tags.link({ noteId: n.id, tagId: t.id, createdAt: T0, updatedAt: T0 });
    }
    await a.engine.sync();
    expect(
      server.state.pushed.map((b) => b.notes.length + b.tags.length + b.noteTags.length)
    ).toEqual([2, 2, 2, 1]);
    expect(server.sync.row(owner.id, 'noteTag', noteTagId(notes[2]!.id, t.id))).toBeDefined();
    expect(await pendingOf(a.store)).toBe(0);
  });

  it('a 410 resyncs from the start, dropping clean rows and keeping owed ones', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    const b = await device(server, owner.id, 'Phone');
    const kept = note('Kept');
    const purged = note('Purged elsewhere');
    await a.store.notes.add(kept);
    await a.store.notes.add(purged);
    await a.engine.sync();
    await b.engine.sync();
    await a.store.notes.purge(purged.id);
    await a.engine.sync();
    server.sync.sweepTombstones(owner.id);
    // A one-page library still hears the 410 (its cursor is `resume`, not `since=0`),
    // and the resync pages past the swept Tombstone because `next` carries `from=0`.
    server.sync.settings.pageSize = 1;
    const offline = note('Written offline');
    await b.store.notes.add(offline);

    await b.engine.sync();
    expect((await b.store.notes.list()).map((n) => n.header).sort()).toEqual([
      'Kept',
      'Written offline',
    ]);
    expect(server.sync.row(owner.id, 'note', offline.id)).toBeDefined();
    expect(await pendingOf(b.store)).toBe(0);
  });

  it('adopts a library once per Account, uploading everything', async () => {
    const { server, owner } = setup();
    const client = server.client();
    const hal = createHalClient(client.fetch);
    await createHalAccountService(hal).signIn('ada', 'correct horse', 'Laptop');
    const store = createMemoryLocalStore();
    await store.notes.add(note('Written before signing in'));
    const engine = createSyncEngine({ store, remote: createHalRemote(hal), deviceName: () => 'x' });

    expect(await engine.adopt(owner.id)).toBe(true);
    expect(await engine.adopt(owner.id)).toBe(false);
    await engine.sync();
    expect(server.state.pushed[0]?.notes).toHaveLength(1);
    expect(await store.meta.get(SYNC_META_KEYS.accountId)).toBe(owner.id);
  });

  it('never overlaps runs, and requests made during one share the next', async () => {
    const { server, owner } = setup();
    const a = await device(server, owner.id, 'Laptop');
    let inFlight = 0;
    let most = 0;
    let runs = 0;
    const pull = a.remote.pull;
    a.remote.pull = async (cursor) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      runs += cursor === null ? 1 : 0;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return pull(cursor);
    };
    const engine = createSyncEngine({ store: a.store, remote: a.remote, deviceName: () => 'x' });

    await Promise.all([engine.sync(), engine.sync(), engine.sync(), engine.sync()]);
    expect(most).toBe(1);
    // One run, then one follow-up shared by the three calls made during it.
    expect(runs).toBe(1);
    expect(await a.store.meta.get(SYNC_META_KEYS.cursor)).toBe('/api/changes?since=0');
  });
});
