import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { NotesDB } from './db.ts';

/** Another tab's connection, opened without Dexie so it runs no code of ours. */
function otherTab(name: string, version?: number) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openTab(reload = vi.fn()) {
  const db = new NotesDB(`versionchange-${crypto.randomUUID()}`, reload);
  await db.open();
  return { db, reload, newerVersion: db.verno * 10 + 10 };
}

describe('NotesDB when another tab changes the database', () => {
  it('reloads when another tab upgrades it', async () => {
    const { db, reload, newerVersion } = await openTab();

    const newer = await otherTab(db.name, newerVersion);

    expect(reload).toHaveBeenCalledOnce();
    newer.close();
  });

  it('reloads when another tab deletes it', async () => {
    const { db, reload } = await openTab();

    await Dexie.delete(db.name);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('stays put when another tab opens the same version', async () => {
    const { db, reload } = await openTab();

    const same = new NotesDB(db.name, vi.fn());
    await same.open();

    expect(reload).not.toHaveBeenCalled();
    same.close();
    db.close();
  });

  it('reopens an upgraded database without upgrading it again, so tabs cannot ping-pong', async () => {
    const { db, newerVersion } = await openTab();
    const newer = await otherTab(db.name, newerVersion);
    const newerToldToClose = vi.fn();
    newer.onversionchange = newerToldToClose;

    const reloaded = new NotesDB(db.name, vi.fn());
    expect(await reloaded.notes.count()).toBe(0);

    expect(newerToldToClose).not.toHaveBeenCalled();
    expect(newer.version).toBe(newerVersion);
    reloaded.close();
    newer.close();
  });
});
