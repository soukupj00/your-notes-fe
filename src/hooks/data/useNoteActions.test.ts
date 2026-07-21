import 'fake-indexeddb/auto';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note, NoteTag } from '@/models.ts';
import { useNoteActions } from './useNoteActions.ts';

// The hook holds no state, so we can call its returned functions directly.
function actions() {
  return renderHook(() => useNoteActions()).result.current;
}

afterEach(async () => {
  await db.notes.clear();
  await db.noteTags.clear();
});

describe('useNoteActions', () => {
  it('persists the rich-text body through create and round-trips it via Dexie', async () => {
    const { createNote } = actions();
    const html = '<p>Hello <strong>world</strong></p>';

    const created = await createNote({ header: 'Note', body: html });
    const stored = await db.notes.get(created.id);

    expect(created.body).toBe(html);
    expect(stored?.body).toBe(html);
  });

  it('updateNote can change the body', async () => {
    const { createNote, updateNote } = actions();
    const created = await createNote({ body: '<p>old</p>' });

    await updateNote(created.id, { body: '<p>new</p>' });

    expect((await db.notes.get(created.id))?.body).toBe('<p>new</p>');
  });

  it('deleteNote returns the removed noteTags and restoreNote reproduces the exact prior state', async () => {
    const { createNote, deleteNote, restoreNote } = actions();
    const created = await createNote({ header: 'Tagged', body: '<p>x</p>' });
    const tag: NoteTag = {
      noteId: created.id,
      tagId: 'tag-1',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
    await db.noteTags.put(tag);

    const removedTags = await deleteNote(created.id);
    expect(await db.notes.get(created.id)).toBeUndefined();
    expect(await db.noteTags.where('noteId').equals(created.id).count()).toBe(0);
    expect(removedTags).toEqual([tag]);

    await restoreNote(created as Note, removedTags);

    expect(await db.notes.get(created.id)).toEqual(created);
    expect(await db.noteTags.where('noteId').equals(created.id).toArray()).toEqual([tag]);
  });
});
