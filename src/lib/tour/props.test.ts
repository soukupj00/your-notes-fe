import { renderHook } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { db } from '@/db/db.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { clearNotesDb } from '@/test/db.ts';
import { createProps, propByKey, purgeProps, rebaseProp } from './props.ts';

afterEach(clearNotesDb);

/** Keys pass straight through, so an assertion can name the key it expects. */
const t = (key: string) => key;

function actions() {
  return renderHook(() => useNoteActions()).result.current;
}

async function seed() {
  const { createNote } = actions();
  return createProps(createNote, t);
}

describe('createProps', () => {
  it('seeds three notes with a baseline apiece', async () => {
    const props = await seed();

    expect(props).toHaveLength(3);
    await expect(db.notes.count()).resolves.toBe(3);

    for (const prop of props) {
      const note = await db.notes.get(prop.id);
      expect(note?.updatedAt).toBe(prop.updatedAt);
    }
  });

  it('gives the three Props distinct colour identities', async () => {
    const props = await seed();
    const notes = await Promise.all(props.map((prop) => db.notes.get(prop.id)));

    // Cool, Base (uncoloured), Deep - see DESIGN.md's swatch names.
    expect(notes.map((note) => note?.color)).toEqual(['green', undefined, 'purple']);
  });

  it('writes bodies TipTap round-trips unchanged', async () => {
    const props = await seed();
    const notes = await Promise.all(props.map((prop) => db.notes.get(prop.id)));

    // The bodies are hand-written HTML rather than editor output, so this is the
    // guard that they are what TipTap would itself have emitted: anything the
    // parser has to correct comes back out different.
    for (const note of notes) {
      const editor = new Editor({
        extensions: [Document, Paragraph, Text, BulletList, ListItem, TaskList, TaskItem],
        content: note?.body,
      });
      expect(editor.getHTML()).toBe(note?.body);
      editor.destroy();
    }
  });

  it('opens the checklist with exactly one item already ticked', async () => {
    const [groceries] = await seed();
    const note = await db.notes.get(groceries.id);
    const items = [...(note?.body ?? '').matchAll(/data-checked="(true|false)"/g)];

    expect(items.map(([, checked]) => checked)).toEqual(['true', 'false', 'false']);
  });
});

describe('purgeProps', () => {
  it('purges every untouched Prop', async () => {
    const { purgeNote } = actions();
    const props = await seed();

    const purged = await purgeProps(purgeNote, props);

    expect(purged).toHaveLength(3);
    await expect(db.notes.count()).resolves.toBe(0);
  });

  it('leaves a Prop the user edited', async () => {
    const { purgeNote, updateNote } = actions();
    const props = await seed();

    // `updatedAt` has millisecond resolution and a test seeds and edits inside
    // one, so the clock has to move for the edit to be visible at all. Only
    // `Date` is faked - faking the timers would stall fake-indexeddb.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    await updateNote(props[0].id, { body: '<p>mine now</p>' });
    vi.useRealTimers();

    const purged = await purgeProps(purgeNote, props);

    expect(purged).not.toContain(props[0].id);
    await expect(db.notes.get(props[0].id)).resolves.toBeDefined();
    await expect(db.notes.count()).resolves.toBe(1);
  });

  it('still purges a Prop the Tour itself wrote to, once rebased', async () => {
    // The regression this whole design exists to prevent: the acts write too -
    // step 3 pins - so a baseline taken at seed time would make every Prop look
    // user-edited and nothing would ever be swept.
    const { purgeNote, pinNote } = actions();
    const seeded = await seed();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    await pinNote(seeded[2].id);
    vi.useRealTimers();

    // Against the seed-time baseline the pin reads as an edit, which is what
    // would have left the Prop on the wall forever.
    expect(await purgeProps(purgeNote, [seeded[2]])).toEqual([]);

    const rebased = await rebaseProp(seeded, seeded[2].id);
    expect(await purgeProps(purgeNote, rebased)).toHaveLength(3);
    await expect(db.notes.count()).resolves.toBe(0);
  });

  it('sweeps an abandoned run on the next start', async () => {
    // A reload at step 2 ends the Tour with no teardown; the baselines survive
    // in the preferences blob and the next start runs the same purge over them.
    const { purgeNote } = actions();
    const abandoned = await seed();

    const purged = await purgeProps(purgeNote, abandoned);

    expect(purged).toHaveLength(3);
    await expect(db.notes.count()).resolves.toBe(0);
  });

  it('tolerates a Prop the user deleted themselves', async () => {
    const { purgeNote } = actions();
    const props = await seed();
    await purgeNote(props[1].id);

    const purged = await purgeProps(purgeNote, props);

    expect(purged).toEqual([props[0].id, props[2].id]);
    await expect(db.notes.count()).resolves.toBe(0);
  });

  it('cascades a Prop’s relationships, because it purges rather than trashes', async () => {
    const { purgeNote } = actions();
    const props = await seed();
    const now = new Date().toISOString();
    await db.noteTags.add({ noteId: props[0].id, tagId: 'tag-1', createdAt: now, updatedAt: now });

    await purgeProps(purgeNote, props);

    await expect(db.noteTags.count()).resolves.toBe(0);
  });
});

describe('propByKey', () => {
  it('finds the Prop the steps name, which is the one they open and pin', async () => {
    const props = await seed();

    const ideas = propByKey(props, 'ideas');

    const note = await db.notes.get(ideas?.id ?? '');
    expect(note?.header).toBe('onboarding.props.ideas.header');
  });

  it('answers undefined for a run that seeded nothing', () => {
    // A restored half-finished run, or a Prop the user deleted mid-Tour. The
    // steps that ask simply do not act.
    expect(propByKey([], 'ideas')).toBeUndefined();
  });
});

describe('rebaseProp', () => {
  it('re-reads only the named Prop', async () => {
    const { updateNote } = actions();
    const props = await seed();

    const updated = await updateNote(props[0].id, { header: 'x' });
    const rebased = await rebaseProp(props, props[0].id);

    expect(rebased[0].updatedAt).toBe(updated?.updatedAt);
    expect(rebased.slice(1)).toEqual(props.slice(1));
  });

  it('leaves the list alone when the Prop is gone', async () => {
    const { purgeNote } = actions();
    const props = await seed();
    await purgeNote(props[0].id);

    await expect(rebaseProp(props, props[0].id)).resolves.toEqual(props);
  });
});
