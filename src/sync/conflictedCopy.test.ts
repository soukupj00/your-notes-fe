import { describe, expect, it } from 'vitest';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import { newAttachment, newNote, newTag } from '@/lib/rows.ts';
import { CONFLICTS_TAG_NAME, keepConflictedCopy } from './conflictedCopy.ts';

const AT = new Date('2030-05-06T07:08:09.000Z');
const png = () => new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });

async function seeded() {
  const store = createMemoryLocalStore();
  const work = newTag('Work');
  await store.tags.add(work);
  const note = newNote({ header: 'Groceries', body: '<p>milk</p>' });
  await store.notes.add(note);
  await store.tags.link({
    noteId: note.id,
    tagId: work.id,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  });
  return { store, note, work };
}

describe('keepConflictedCopy', () => {
  it('writes an ordinary Note, titled for its origin, stamped at the moment of the conflict', async () => {
    const { store, note, work } = await seeded();
    await keepConflictedCopy(store, { ...note, tags: [work] }, 'Pixel 8', AT);

    const copies = (await store.notes.list()).filter((n) => n.id !== note.id);
    expect(copies).toHaveLength(1);
    const copy = copies[0]!;
    expect(copy.header).toBe('Groceries (conflict from Pixel 8, 2030-05-06)');
    expect(copy.body).toBe('<p>milk</p>');
    expect(copy.createdAt).toBe(AT.toISOString());
    expect(copy.updatedAt).toBe(AT.toISOString());
    expect(copy.tags).toBeUndefined();

    const links = (await store.tags.listLinks()).filter((l) => l.noteId === copy.id);
    const conflicts = await store.tags.findByName(CONFLICTS_TAG_NAME);
    expect(links.map((l) => l.tagId).sort()).toEqual([work.id, conflicts!.id].sort());
    expect(links.every((l) => l.createdAt === AT.toISOString())).toBe(true);
  });

  it('reuses the Conflicts Tag on the second conflict and returns its id', async () => {
    const { store, note } = await seeded();
    const first = await keepConflictedCopy(store, note, 'Pixel 8', AT);
    const second = await keepConflictedCopy(store, note, 'Laptop', AT);
    expect(second).toBe(first);
    expect((await store.tags.list()).filter((t) => t.name === CONFLICTS_TAG_NAME)).toHaveLength(1);
  });

  it('clones each Attachment under a new id, repoints the Body, and stamps the clone at the conflict', async () => {
    const { store, note } = await seeded();
    const att = newAttachment(note.id, png(), 'image', {}, '2020-01-01T00:00:00.000Z');
    await store.attachments.add(att);
    await store.notes.put({ ...note, body: `<img data-attachment-id="${att.id}">` });

    await keepConflictedCopy(
      store,
      { ...note, body: `<img data-attachment-id="${att.id}">` },
      'Pixel 8',
      AT
    );

    const copy = (await store.notes.list()).find((n) => n.id !== note.id)!;
    const clones = (await store.attachments.list()).filter((a) => a.noteId === copy.id);
    expect(clones).toHaveLength(1);
    const clone = clones[0]!;
    expect(clone.id).not.toBe(att.id);
    expect(copy.body).toBe(`<img data-attachment-id="${clone.id}">`);
    expect(clone.createdAt).toBe(AT.toISOString());
    expect(await clone.blob?.arrayBuffer()).toEqual(await att.blob?.arrayBuffer());
  });

  it('fetches bytes this Device does not hold, and keeps the metadata when the fetch fails', async () => {
    const { store, note } = await seeded();
    const att = { ...newAttachment(note.id, png(), 'image'), blob: undefined };
    await store.attachments.add(att);
    const local = { ...note, body: `<img data-attachment-id="${att.id}">` };

    await keepConflictedCopy(store, local, 'Pixel 8', AT, async (id) =>
      id === att.id ? new Blob(['fetched']) : undefined
    );
    let clones = (await store.attachments.list()).filter((a) => a.id !== att.id);
    expect(clones).toHaveLength(1);
    expect(await clones[0]!.blob?.text()).toBe('fetched');

    await keepConflictedCopy(store, local, 'Laptop', AT, async () => {
      throw new Error('offline');
    });
    clones = (await store.attachments.list()).filter((a) => a.id !== att.id);
    expect(clones).toHaveLength(2);
    expect(clones.some((c) => c.blob === undefined && c.name === 'pic.png')).toBe(true);
  });
});
