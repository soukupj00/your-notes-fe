import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createDexieLocalStore } from './DexieLocalStore.ts';
import { NotesDB } from './db.ts';

const NAME = 'SyncMigrationTestDB';
const T0 = '2026-01-01T00:00:00.000Z';

/**
 * A v4 database, built from the shipped v4 schema literally (not from whatever
 * `NotesDB` declares today), so the test proves a pre-sync database opens as v5.
 */
async function seedV4Database() {
  const legacy = new Dexie(NAME);
  legacy.version(4).stores({
    notes: 'id, header, createdAt, updatedAt, state, pinnedAt, trashedAt',
    attachments: 'id, noteId, kind',
    tags: 'id, name',
    noteTags: '[noteId+tagId], noteId, tagId',
    settings: 'key',
  });
  await legacy.open();
  await legacy.table('notes').add({ id: 'n1', state: 'active', createdAt: T0, updatedAt: T0 });
  await legacy.table('tags').add({ id: 't1', name: 'Work', createdAt: T0, updatedAt: T0 });
  await legacy.table('noteTags').add({ noteId: 'n1', tagId: 't1', createdAt: T0, updatedAt: T0 });
  legacy.close();
}

afterEach(async () => {
  await Dexie.delete(NAME);
});

describe('Dexie v5 sync metadata', () => {
  it('keeps every pre-sync row, owes none of them, and has an empty tombstones store', async () => {
    await seedV4Database();

    const db = new NotesDB(NAME);
    const store = createDexieLocalStore(db);
    expect(await store.notes.get('n1')).toMatchObject({ id: 'n1', state: 'active' });
    expect(await store.tags.listLinks()).toHaveLength(1);
    // No backfill: an absent `rev` is "never pushed", an absent `dirty` is "not owed".
    // Adopt-on-first-sign-in (slice 4) is what owes a pre-sync library.
    expect(await store.sync.dirty()).toEqual({ notes: [], tags: [], noteTags: [], tombstones: [] });
    expect(await db.tombstones.count()).toBe(0);
    db.close();
  });

  it('indexes the dirty marker, so owed rows are one index read', async () => {
    await seedV4Database();

    const db = new NotesDB(NAME);
    const store = createDexieLocalStore(db);
    await store.notes.update('n1', () => ({ header: 'edited' }));
    expect(await db.notes.where('dirty').equals(1).primaryKeys()).toEqual(['n1']);
    db.close();
  });
});
