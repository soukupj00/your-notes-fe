import { afterEach, describe, expect, it } from 'vitest';
import { isCustomOrder, labelCollator, sortLabels } from '@/lib/label-order.ts';
import type { Tag } from '@/models.ts';
import { clearStore, renderHookWithStore, testStore } from '@/test/store.tsx';
import { useTagActions } from './useTagActions.ts';

const actions = () => renderHookWithStore(() => useTagActions()).result.current;

const linkedNoteIds = async (tagId: string) =>
  (await testStore.tags.listLinks())
    .filter((link) => link.tagId === tagId)
    .map((link) => link.noteId)
    .sort();

afterEach(clearStore);

describe('createTag', () => {
  it('creates a tag with a colour', async () => {
    const tag = await actions().createTag('Work', 'blue');

    expect(await testStore.tags.get(tag.id)).toMatchObject({ name: 'Work', color: 'blue' });
  });

  it('trims the name', async () => {
    const tag = await actions().createTag('  Work  ');
    expect(tag.name).toBe('Work');
  });

  it('reuses an existing tag rather than creating a case-variant duplicate', async () => {
    const first = await actions().createTag('Work');
    const second = await actions().createTag('work');

    expect(second.id).toBe(first.id);
    expect(await testStore.tags.list()).toHaveLength(1);
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
    expect(await testStore.tags.get(tag.id)).toMatchObject({ name: 'Work', color: 'red' });

    // `undefined` is the "no colour" value, and must actually clear the field.
    await actions().updateTag(tag.id, { color: undefined });
    expect((await testStore.tags.get(tag.id))?.color).toBeUndefined();
  });

  it('keeps the old name when the new one is only whitespace', async () => {
    const tag = await actions().createTag('Work');
    const updated = await actions().updateTag(tag.id, { name: '   ' });
    expect(updated?.name).toBe('Work');
    expect((await testStore.tags.get(tag.id))?.name).toBe('Work');
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

    expect(await testStore.tags.get(tag.id)).toBeUndefined();
    expect((await testStore.tags.listLinks()).filter((l) => l.tagId === tag.id)).toHaveLength(0);
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
    expect(await testStore.tags.get(source.id)).toBeUndefined();
    expect((await testStore.tags.listLinks()).filter((l) => l.tagId === source.id)).toHaveLength(0);
  });

  it('dedupes notes that carried both tags', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const source = await createTag('Job');
    const target = await createTag('Work');
    await addTagToNote('n1', source.id);
    await addTagToNote('n1', target.id);

    await mergeTags(source.id, target.id);

    expect(await linkedNoteIds(target.id)).toEqual(['n1']);
    expect(await testStore.tags.listLinks()).toHaveLength(1);
  });

  it('is a no-op when source and target are the same tag', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const tag = await createTag('Work');
    await addTagToNote('n1', tag.id);

    await mergeTags(tag.id, tag.id);

    expect(await testStore.tags.get(tag.id)).toBeDefined();
    expect(await linkedNoteIds(tag.id)).toEqual(['n1']);
  });

  it('leaves everything alone when the target does not exist', async () => {
    const { createTag, addTagToNote, mergeTags } = actions();
    const source = await createTag('Job');
    await addTagToNote('n1', source.id);

    await expect(mergeTags(source.id, 'nope')).rejects.toThrow();

    expect(await testStore.tags.get(source.id)).toBeDefined();
    expect(await linkedNoteIds(source.id)).toEqual(['n1']);
  });
});

describe('note assignment', () => {
  it('does not double-link the same tag', async () => {
    const { createTag, addTagToNote } = actions();
    const tag = await createTag('Work');

    await addTagToNote('n1', tag.id);
    await addTagToNote('n1', tag.id);

    expect(await testStore.tags.listLinks()).toHaveLength(1);
  });

  it('removes a single link without touching the tag', async () => {
    const { createTag, addTagToNote, removeTagFromNote } = actions();
    const tag = await createTag('Work');
    await addTagToNote('n1', tag.id);
    await addTagToNote('n2', tag.id);

    await removeTagFromNote('n1', tag.id);

    expect(await linkedNoteIds(tag.id)).toEqual(['n2']);
    expect(await testStore.tags.get(tag.id)).toBeDefined();
  });
});

describe('label order', () => {
  const sortedNames = async () =>
    sortLabels(await testStore.tags.list(), labelCollator('en')).map((tag) => tag.name);

  it('createTag gives no position while nothing is arranged, and its A to Z place after', async () => {
    const { createTag, moveTag } = actions();
    const work = await createTag('Work');
    const ideas = await createTag('Ideas');
    expect(work.position).toBeUndefined();
    expect(ideas.position).toBeUndefined();

    await moveTag(work.id, ideas.id);
    const groceries = await createTag('Groceries');

    expect(groceries.position).toEqual(expect.any(String));
    expect(await sortedNames()).toEqual(['Groceries', 'Work', 'Ideas']);
  });

  it('moveTag on a never-dragged list positions every label', async () => {
    const { createTag, moveTag } = actions();
    await createTag('A');
    await createTag('B');
    const c = await createTag('C');
    const a = (await testStore.tags.findByName('A')) as Tag;

    await moveTag(c.id, a.id);

    const stored = await testStore.tags.list();
    expect(stored.every((tag) => typeof tag.position === 'string')).toBe(true);
    expect(await sortedNames()).toEqual(['C', 'A', 'B']);
  });

  it('arrangeTags then undo restores the previous positions, none included', async () => {
    const { createTag, arrangeTags } = actions();
    await createTag('Alpha');
    await createTag('Beta');

    const undo = await arrangeTags('za');
    expect(await sortedNames()).toEqual(['Beta', 'Alpha']);

    await undo();
    expect(isCustomOrder(await testStore.tags.list())).toBe(false);
    expect((await actions().createTag('Gamma')).position).toBeUndefined();
    expect(await sortedNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('arrangeTags undo on a never-dragged list also unpins a label created since', async () => {
    const { createTag, arrangeTags } = actions();
    await createTag('Beta');
    await createTag('Gamma');

    const undo = await arrangeTags('za');
    await actions().createTag('Alpha');
    await undo();

    expect(isCustomOrder(await testStore.tags.list())).toBe(false);
    expect(await sortedNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('arrangeTags undo puts back a custom order exactly', async () => {
    const { createTag, moveTag, arrangeTags } = actions();
    const a = await createTag('A');
    const b = await createTag('B');
    await moveTag(b.id, a.id);
    const before = await sortedNames();

    const undo = await arrangeTags('az');
    expect(await sortedNames()).toEqual(['A', 'B']);
    await undo();

    expect(await sortedNames()).toEqual(before);
  });
});
