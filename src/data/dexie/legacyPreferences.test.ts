import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotesDB } from './db.ts';
import { migrateLegacyPreferences } from './legacyPreferences.ts';

describe('migrateLegacyPreferences', () => {
  afterEach(() => localStorage.clear());

  it('moves the blob to localStorage, the Prop baselines to meta, and deletes the row', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    const props = [{ id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' }];
    await db.settings.put({
      key: 'preferences',
      value: { version: 2, density: 'compact', tourProps: props },
    });

    await migrateLegacyPreferences(db);

    expect(JSON.parse(localStorage.getItem('preferences') ?? 'null')).toEqual({
      version: 2,
      density: 'compact',
    });
    expect((await db.settings.get('tourProps'))?.value).toEqual(props);
    expect(await db.settings.get('preferences')).toBeUndefined();
  });

  it('never overwrites preferences localStorage already holds', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    localStorage.setItem('preferences', JSON.stringify({ version: 2, density: 'comfortable' }));
    await db.settings.put({
      key: 'preferences',
      value: { version: 2, density: 'compact', tourProps: [] },
    });
    await migrateLegacyPreferences(db);
    expect(JSON.parse(localStorage.getItem('preferences') ?? 'null')).toEqual({
      version: 2,
      density: 'comfortable',
    });
    expect(await db.settings.get('preferences')).toBeUndefined();
  });

  it('is a no-op on a database with no row', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    await expect(migrateLegacyPreferences(db)).resolves.toBeUndefined();
    expect(localStorage.getItem('preferences')).toBeNull();
  });

  it('leaves the legacy row in place when localStorage.setItem throws', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    await db.settings.put({ key: 'preferences', value: { version: 2, density: 'compact' } });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    await expect(migrateLegacyPreferences(db)).rejects.toThrow('quota');

    setItem.mockRestore();
    expect(await db.settings.get('preferences')).toBeDefined();
  });
});
