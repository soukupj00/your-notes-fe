import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { NotesDB } from './db.ts';

const NAME = 'LifecycleMigrationTestDB';

/**
 * Recreate a *pre-v3* database by hand. The v1/v2 schemas are duplicated here
 * on purpose: the point of the test is that a database written by the shipped
 * v2 app survives the v3 upgrade, so it must be built from the old schema
 * literally rather than from whatever `NotesDB` declares today.
 */
async function seedLegacyDatabase(rows: Record<string, unknown>[]) {
  const legacy = new Dexie(NAME);
  legacy.version(1).stores({
    notes: 'id, header, createdAt, updatedAt',
    images: 'id, noteId',
    audios: 'id, noteId',
    files: 'id, noteId',
    tags: 'id, name',
    noteTags: '[noteId+tagId], noteId, tagId',
  });
  legacy.version(2).stores({
    attachments: 'id, noteId, kind',
    images: null,
    audios: null,
    files: null,
  });
  await legacy.open();
  await legacy.table('notes').bulkAdd(rows);
  legacy.close();
}

function legacyNote(id: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id,
    header: id,
    description: '',
    body: '',
    checklist: ['a', 'b'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(async () => {
  await Dexie.delete(NAME);
});

describe('Dexie v3 lifecycle upgrade', () => {
  it("stamps existing notes with state 'active' and drops the dead checklist", async () => {
    await seedLegacyDatabase([legacyNote('legacy-1')]);

    const db = new NotesDB(NAME);
    const migrated = await db.notes.get('legacy-1');
    db.close();

    expect(migrated?.state).toBe('active');
    expect(migrated).not.toHaveProperty('checklist');
    // Untouched content survives the upgrade.
    expect(migrated?.header).toBe('legacy-1');
  });

  it('leaves migrated notes reachable through the indexed state query', async () => {
    await seedLegacyDatabase([legacyNote('legacy-1'), legacyNote('legacy-2')]);

    const db = new NotesDB(NAME);
    const active = await db.notes.where('state').equals('active').toArray();
    db.close();

    // This is the regression the upgrade exists for: without it these rows have
    // no `state` value, IndexedDB never indexes them, and the feed comes back empty.
    expect(active.map((n) => n.id).sort()).toEqual(['legacy-1', 'legacy-2']);
  });

  it('round-trips the new lifecycle fields and Tag.color', async () => {
    const db = new NotesDB(NAME);
    const now = new Date().toISOString();

    await db.notes.add({
      id: 'n1',
      header: 'pinned + coloured',
      state: 'archived',
      pinnedAt: now,
      color: 'teal',
      trashedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.tags.add({ id: 't1', name: 'Work', color: 'purple', createdAt: now, updatedAt: now });

    const note = await db.notes.get('n1');
    const tag = await db.tags.get('t1');
    db.close();

    expect(note).toMatchObject({ state: 'archived', pinnedAt: now, color: 'teal', trashedAt: now });
    expect(tag?.color).toBe('purple');
  });

  it('queries notes by state and by trashedAt range', async () => {
    const db = new NotesDB(NAME);
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    await db.notes.bulkAdd([
      { id: 'a', state: 'active', createdAt: now, updatedAt: now },
      { id: 'b', state: 'archived', createdAt: now, updatedAt: now },
      { id: 'c', state: 'trashed', trashedAt: old, createdAt: now, updatedAt: now },
      { id: 'd', state: 'trashed', trashedAt: now, createdAt: now, updatedAt: now },
    ]);

    const trashed = await db.notes.where('state').equals('trashed').toArray();
    const expired = await db.notes
      .where('trashedAt')
      .below(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .toArray();
    db.close();

    expect(trashed.map((n) => n.id).sort()).toEqual(['c', 'd']);
    expect(expired.map((n) => n.id)).toEqual(['c']);
  });
});
