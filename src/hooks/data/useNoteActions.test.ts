import { afterEach, describe, expect, it } from 'vitest';
import type { Attachment, Note, NoteTag } from '@/models.ts';
import { clearStore, renderHookWithStore, testStore } from '@/test/store.tsx';
import { useNoteActions } from './useNoteActions.ts';

// The hook holds no state, so we can call its returned functions directly.
function actions() {
  return renderHookWithStore(() => useNoteActions()).result.current;
}

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'h',
    description: '',
    body: '',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAtt(noteId: string): Attachment {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    noteId,
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x']),
    createdAt: now,
    updatedAt: now,
  };
}

afterEach(clearStore);

describe('useNoteActions', () => {
  it("creates notes 'active' and unpinned, and lets callers seed lifecycle fields", async () => {
    const { createNote } = actions();

    const plain = await createNote({ header: 'Plain' });
    expect(plain.state).toBe('active');
    expect(plain.pinnedAt).toBeUndefined();
    expect(plain.color).toBeUndefined();
    // The indexed state query is what the feed uses - a created note must land in it.
    expect(await testStore.notes.listByState('active')).toHaveLength(1);

    const seeded = await createNote({ header: 'Seeded', state: 'archived', color: 'teal' });
    expect(await testStore.notes.get(seeded.id)).toMatchObject({
      state: 'archived',
      color: 'teal',
    });
  });

  it('persists the rich-text body through create and round-trips it via the store', async () => {
    const { createNote } = actions();
    const html = '<p>Hello <strong>world</strong></p>';

    const created = await createNote({ header: 'Note', body: html });
    const stored = await testStore.notes.get(created.id);

    expect(created.body).toBe(html);
    expect(stored?.body).toBe(html);
  });

  it('updateNote can change the body', async () => {
    const { createNote, updateNote } = actions();
    const created = await createNote({ body: '<p>old</p>' });

    await updateNote(created.id, { body: '<p>new</p>' });

    expect((await testStore.notes.get(created.id))?.body).toBe('<p>new</p>');
  });

  it('purgeNote returns the removed noteTags and restoreNote reproduces the exact prior state', async () => {
    const { createNote, purgeNote, restoreNote } = actions();
    const created = await createNote({ header: 'Tagged', body: '<p>x</p>' });
    const tag: NoteTag = {
      noteId: created.id,
      tagId: 'tag-1',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
    await testStore.tags.link(tag);

    const removed = await purgeNote(created.id);
    expect(await testStore.notes.get(created.id)).toBeUndefined();
    expect((await testStore.tags.listLinks()).filter((l) => l.noteId === created.id)).toEqual([]);
    expect(removed.removedTags).toEqual([tag]);
    expect(removed.removedAttachments).toEqual([]);

    await restoreNote(created as Note, removed);

    expect(await testStore.notes.get(created.id)).toEqual(created);
    expect((await testStore.tags.listLinks()).filter((l) => l.noteId === created.id)).toEqual([
      tag,
    ]);
  });
});

describe('purgeNote / restoreNote cascade attachments', () => {
  it('purgeNote removes + returns the note attachments', async () => {
    const a = actions();
    const note = makeNote();
    await testStore.notes.put(note);
    const att = makeAtt(note.id);
    await testStore.attachments.add(att);

    const removed = await a.purgeNote(note.id);
    expect(removed.removedAttachments.map((r) => r.id)).toEqual([att.id]);
    expect(await testStore.attachments.get(att.id)).toBeUndefined();
  });

  it('restoreNote re-puts the note and its attachments', async () => {
    const a = actions();
    const note = makeNote();
    await testStore.notes.put(note);
    const att = makeAtt(note.id);
    await testStore.attachments.add(att);

    const removed = await a.purgeNote(note.id);
    await a.restoreNote(note, removed);
    expect(await testStore.notes.get(note.id)).toBeTruthy();
    expect(await testStore.attachments.get(att.id)).toBeTruthy();
  });
});
