import { afterEach, describe, expect, it } from 'vitest';
import type { Attachment, Note } from '@/models.ts';
import { clearStore, renderHookWithStore, testStore } from '@/test/store.tsx';
import { TRASH_GRACE_DAYS, useNoteActions } from './useNoteActions.ts';

function actions() {
  return renderHookWithStore(() => useNoteActions()).result.current;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

async function putNote(overrides: Partial<Note> = {}): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    header: 'h',
    body: '',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await testStore.notes.put(note);
  return note;
}

async function putAttachment(noteId: string): Promise<Attachment> {
  const now = new Date().toISOString();
  const att: Attachment = {
    id: crypto.randomUUID(),
    noteId,
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x']),
    createdAt: now,
    updatedAt: now,
  };
  await testStore.attachments.add(att);
  return att;
}

afterEach(clearStore);

describe('lifecycle transitions', () => {
  it('pinNote sets pinnedAt and unpinNote clears it', async () => {
    const { pinNote, unpinNote } = actions();
    const note = await putNote();

    await pinNote(note.id);
    expect((await testStore.notes.get(note.id))?.pinnedAt).toEqual(expect.any(String));

    await unpinNote(note.id);
    expect((await testStore.notes.get(note.id))?.pinnedAt).toBeUndefined();
  });

  it('archiveNote moves the note out of active and clears the pin', async () => {
    const { archiveNote } = actions();
    const note = await putNote({ pinnedAt: daysAgo(1) });

    await archiveNote(note.id);

    const stored = await testStore.notes.get(note.id);
    expect(stored?.state).toBe('archived');
    // ADR 0009: a pin is only meaningful while active, so archiving drops it.
    expect(stored?.pinnedAt).toBeUndefined();
  });

  it('trashNote stamps trashedAt and clears the pin', async () => {
    const { trashNote } = actions();
    const note = await putNote({ pinnedAt: daysAgo(1) });

    await trashNote(note.id);

    const stored = await testStore.notes.get(note.id);
    expect(stored?.state).toBe('trashed');
    expect(stored?.trashedAt).toEqual(expect.any(String));
    expect(stored?.pinnedAt).toBeUndefined();
  });

  it('restoreToActive brings back both archived and trashed notes', async () => {
    const { archiveNote, trashNote, restoreToActive } = actions();
    const archived = await putNote();
    const trashed = await putNote();

    await archiveNote(archived.id);
    await trashNote(trashed.id);
    await restoreToActive(archived.id);
    await restoreToActive(trashed.id);

    expect((await testStore.notes.get(archived.id))?.state).toBe('active');
    const restored = await testStore.notes.get(trashed.id);
    expect(restored?.state).toBe('active');
    // Leaving trashedAt behind would make a restored note eligible for the purge sweep.
    expect(restored?.trashedAt).toBeUndefined();
  });

  it('a transition on a missing note is a no-op rather than a throw', async () => {
    const { trashNote } = actions();
    await expect(trashNote('nope')).resolves.toBeNull();
  });
});

describe('undo via revertLifecycle', () => {
  it('restores the exact prior lifecycle state, including updatedAt', async () => {
    const { trashNote, revertLifecycle } = actions();
    const note = await putNote({ pinnedAt: daysAgo(2), updatedAt: daysAgo(5) });

    const before = await trashNote(note.id);
    if (!before) throw new Error('expected a snapshot');
    await revertLifecycle(note.id, before);

    const stored = await testStore.notes.get(note.id);
    expect(stored?.state).toBe('active');
    expect(stored?.pinnedAt).toBe(note.pinnedAt);
    expect(stored?.trashedAt).toBeUndefined();
    // The whole point of snapshotting updatedAt: an undone transition leaves no trace.
    expect(stored?.updatedAt).toBe(note.updatedAt);
  });

  it('undoing an archive puts the note back in the feed with its pin', async () => {
    const { archiveNote, revertLifecycle } = actions();
    const note = await putNote({ pinnedAt: daysAgo(2) });

    const before = await archiveNote(note.id);
    if (!before) throw new Error('expected a snapshot');
    await revertLifecycle(note.id, before);

    expect(await testStore.notes.get(note.id)).toMatchObject({
      state: 'active',
      pinnedAt: note.pinnedAt,
    });
  });

  it('undoing a pin clears pinnedAt again', async () => {
    const { pinNote, revertLifecycle } = actions();
    const note = await putNote();

    const before = await pinNote(note.id);
    if (!before) throw new Error('expected a snapshot');
    await revertLifecycle(note.id, before);

    expect((await testStore.notes.get(note.id))?.pinnedAt).toBeUndefined();
  });
});

describe('purgeExpiredTrash', () => {
  it('purges only trashed notes past the grace period, cascading attachments', async () => {
    const { purgeExpiredTrash } = actions();
    const expired = await putNote({ state: 'trashed', trashedAt: daysAgo(TRASH_GRACE_DAYS + 1) });
    const fresh = await putNote({ state: 'trashed', trashedAt: daysAgo(TRASH_GRACE_DAYS - 1) });
    const active = await putNote();
    const expiredAtt = await putAttachment(expired.id);

    const purged = await purgeExpiredTrash();

    expect(purged).toBe(1);
    expect(await testStore.notes.get(expired.id)).toBeUndefined();
    expect(await testStore.attachments.get(expiredAtt.id)).toBeUndefined();
    expect(await testStore.notes.get(fresh.id)).toBeTruthy();
    expect(await testStore.notes.get(active.id)).toBeTruthy();
  });

  it('spares a note restored from trash even if its old trashedAt was expired', async () => {
    const { restoreToActive, purgeExpiredTrash } = actions();
    // A note trashed long ago and restored: the sweep queries by trashedAt, so
    // it would still match if restoreToActive failed to clear the timestamp.
    const note = await putNote({ state: 'trashed', trashedAt: daysAgo(TRASH_GRACE_DAYS + 10) });
    await restoreToActive(note.id);

    expect(await purgeExpiredTrash()).toBe(0);
    expect(await testStore.notes.get(note.id)).toBeTruthy();
  });

  it('honours a caller-supplied grace period', async () => {
    const { purgeExpiredTrash } = actions();
    const note = await putNote({ state: 'trashed', trashedAt: daysAgo(3) });

    expect(await purgeExpiredTrash(30)).toBe(0);
    expect(await purgeExpiredTrash(2)).toBe(1);
    expect(await testStore.notes.get(note.id)).toBeUndefined();
  });
});

describe('emptyTrash', () => {
  it('purges every trashed note and its attachments, leaving the rest alone', async () => {
    const { archiveNote, emptyTrash } = actions();
    const trashedA = await putNote({ state: 'trashed', trashedAt: daysAgo(1) });
    const trashedB = await putNote({ state: 'trashed', trashedAt: daysAgo(20) });
    const active = await putNote();
    const archived = await putNote();
    await archiveNote(archived.id);
    const att = await putAttachment(trashedB.id);

    expect(await emptyTrash()).toBe(2);

    expect(await testStore.notes.get(trashedA.id)).toBeUndefined();
    expect(await testStore.notes.get(trashedB.id)).toBeUndefined();
    expect(await testStore.attachments.get(att.id)).toBeUndefined();
    expect(await testStore.notes.get(active.id)).toBeTruthy();
    expect(await testStore.notes.get(archived.id)).toBeTruthy();
  });
});
