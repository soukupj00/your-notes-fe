import { beforeEach, describe, expect, it } from 'vitest';
import type { Tag } from '@/models.ts';
import type { LocalStore } from './LocalStore.ts';
import type { Live } from './live.ts';
import { link, note, syncAll, tag } from './localStore.sync.contract.ts';

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

const positionsOf = (tags: Tag[]) => Object.fromEntries(tags.map((t) => [t.id, t.position]));

/** Label order (ADR 0027) and the Labels page's note counts. Run from `describeLocalStoreContract`. */
export function describeLocalStoreLabelsContract(makeStore: () => Promise<LocalStore>) {
  describe('LocalStore labels contract', () => {
    let store: LocalStore;
    beforeEach(async () => {
      store = await makeStore();
    });

    it('setPositions writes every listed tag in one go and owes them to the server', async () => {
      const [a, b, c] = [tag(), tag(), tag()];
      for (const t of [a, b, c]) await store.tags.add(t);
      await syncAll(store, 2);

      await store.tags.setPositions(
        new Map([
          [a.id, 'a0'],
          [b.id, 'a1'],
          ['unknown', 'a2'],
        ])
      );

      const stored = await store.tags.list();
      expect(positionsOf(stored)).toEqual({ [a.id]: 'a0', [b.id]: 'a1', [c.id]: undefined });
      for (const t of stored.filter((row) => row.id !== c.id)) {
        expect(t.updatedAt > a.updatedAt).toBe(true);
      }
      const pushed = (await store.sync.dirty()).tags;
      expect(pushed.map((t) => [t.id, t.position, t.rev]).sort()).toEqual(
        [
          [a.id, 'a0', 2],
          [b.id, 'a1', 2],
        ].sort()
      );
    });

    it('setPositions with null clears the position and the push carries null', async () => {
      const t = { ...tag(), position: 'a0' };
      await store.tags.add(t);
      await syncAll(store);

      await store.tags.setPositions(new Map([[t.id, null]]));

      expect((await store.tags.get(t.id))?.position ?? undefined).toBeUndefined();
      expect((await store.sync.dirty()).tags).toEqual([
        expect.objectContaining({ id: t.id, position: null }),
      ]);
    });

    it('noteCounts counts active and archived notes, not trashed ones, live', async () => {
      const t = tag();
      const other = tag();
      const notes = [note(), note({ state: 'archived' }), note({ state: 'trashed' })];
      await store.tags.add(t);
      await store.tags.add(other);
      for (const n of notes) {
        await store.notes.add(n);
        await store.tags.link(link(n.id, t.id));
      }

      const counts = latest(store.tags.noteCounts());
      await until(() => counts.value()?.[t.id] === 2);
      expect(counts.value()).toEqual({ [t.id]: 2 });

      await store.notes.update(notes[0].id, () => ({ state: 'trashed' }));
      await until(() => counts.value()?.[t.id] === 1);
      counts.stop();
    });
  });
}
