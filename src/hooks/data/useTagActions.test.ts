import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import { useTagActions } from './useTagActions.ts';

const actions = () => renderHook(() => useTagActions()).result.current;

const linkedNoteIds = async (tagId: string) =>
  (await db.noteTags.where('tagId').equals(tagId).toArray()).map((link) => link.noteId).sort();

afterEach(async () => {
  await db.tags.clear();
  await db.noteTags.clear();
});

describe('createTag', () => {
  it('creates a tag with a colour', async () => {
    const tag = await actions().createTag('Work', 'blue');

    expect(await db.tags.get(tag.id)).toMatchObject({ name: 'Work', color: 'blue' });
  });

  it('trims the name', async () => {
    const tag = await actions().createTag('  Work  ');
    expect(tag.name).toBe('Work');
  });

  it('reuses an existing tag rather than creating a case-variant duplicate', async () => {
    const first = await actions().createTag('Work');
    const second = await actions().createTag('work');

    expect(second.id).toBe(first.id);
    expect(await db.tags.count()).toBe(1);
  });
});

describe('updateTag', () => {
  it('renames a tag and bumps updatedAt', async () => {
    const tag = await actions().createTag('Work');
    const before = tag.updatedAt;

    const updated = await actions().updateTag(tag.id, { name: 'Job' });

    expect(updated?.name).toBe('Job');
    expect((updated?.updatedAt ?? '') >= before).toBe(true);
  });

  it('sets and clears the colour independently of the name', async () => {
    const tag = await actions().createTag('Work', 'blue');

    await actions().updateTag(tag.id, { color: 'red' });
    expect(await db.tags.get(tag.id)).toMatchObject({ name: 'Work', color: 'red' });

    // `undefined` is the "no colour" value, and must actually clear the field.
    await actions().updateTag(tag.id, { color: undefined });
    expect((await db.tags.get(tag.id))?.color).toBeUndefined();
  });

  it('returns null for an unknown tag', async () => {
    expect(await actions().updateTag('nope', { name: 'x' })).toBeNull();
  });
});

describe('deleteTag', () => {
  it('detaches the tag from every note it was on', async () => {
    const tag = await actions().createTag('Work');
    await actions().addTagToNote('n1', tag.id);
    await actions().addTagToNote('n2', tag.id);

    await actions().deleteTag(tag.id);

    expect(await db.tags.get(tag.id)).toBeUndefined();
    expect(await db.noteTags.where('tagId').equals(tag.id).count()).toBe(0);
  });
});

describe('mergeTags', () => {
  it('reassigns the source tag’s notes to the target and deletes the source', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const source = await createTag('Job');
    const target = await createTag('Work');
    await addTagToNote('n1', source.id);
    await addTagToNote('n2', source.id);
    await addTagToNote('n3', target.id);

    await mergeTags(source.id, target.id);

    expect(await linkedNoteIds(target.id)).toEqual(['n1', 'n2', 'n3']);
    expect(await db.tags.get(source.id)).toBeUndefined();
    expect(await db.noteTags.where('tagId').equals(source.id).count()).toBe(0);
  });

  it('dedupes notes that carried both tags', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const source = await createTag('Job');
    const target = await createTag('Work');
    await addTagToNote('n1', source.id);
    await addTagToNote('n1', target.id);

    await mergeTags(source.id, target.id);

    expect(await linkedNoteIds(target.id)).toEqual(['n1']);
    expect(await db.noteTags.count()).toBe(1);
  });

  it('is a no-op when source and target are the same tag', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const tag = await createTag('Work');
    await addTagToNote('n1', tag.id);

    await mergeTags(tag.id, tag.id);

    expect(await db.tags.get(tag.id)).toBeDefined();
    expect(await linkedNoteIds(tag.id)).toEqual(['n1']);
  });

  it('leaves everything alone when the target does not exist', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const source = await createTag('Job');
    await addTagToNote('n1', source.id);

    await expect(mergeTags(source.id, 'nope')).rejects.toThrow();

    expect(await db.tags.get(source.id)).toBeDefined();
    expect(await linkedNoteIds(source.id)).toEqual(['n1']);
  });
});

describe('note assignment', () => {
  it('does not double-link the same tag', async () => {
    const { createTag, addTagToNote } = actions();
    const tag = await createTag('Work');

    await addTagToNote('n1', tag.id);
    await addTagToNote('n1', tag.id);

    expect(await db.noteTags.count()).toBe(1);
  });

  it('removes a single link without touching the tag', async () => {
    const { createTag, addTagToNote, removeTagFromNote } = actions();
    const tag = await createTag('Work');
    await addTagToNote('n1', tag.id);
    await addTagToNote('n2', tag.id);

    await removeTagFromNote('n1', tag.id);

    expect(await linkedNoteIds(tag.id)).toEqual(['n2']);
    expect(await db.tags.get(tag.id)).toBeDefined();
  });
});
