import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it, vi } from 'vitest';
import { BulletList } from '@/components/editor/extensions/formatting';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import { createProps, propByKey, purgeProps, readProps, rebaseProp } from './props.ts';

/** Keys pass straight through, so an assertion can name the key it expects. */
const t = (key: string) => key;

function seed() {
  const store = createMemoryLocalStore();
  return { store, seeded: createProps(store, t) };
}

/** `purgeNote` for a store: purges through it and returns whatever it removed. */
function purgeNoteFor(store: ReturnType<typeof createMemoryLocalStore>) {
  return (id: string) => store.notes.purge(id);
}

describe('createProps', () => {
  it('seeds three notes with a baseline apiece', async () => {
    const { store, seeded } = seed();
    const props = await seeded;

    expect(props).toHaveLength(3);
    await expect(store.notes.list()).resolves.toHaveLength(3);

    for (const prop of props) {
      const note = await store.notes.get(prop.id);
      expect(note?.updatedAt).toBe(prop.updatedAt);
    }
  });

  it('gives the three Props distinct colour identities', async () => {
    const { store, seeded } = seed();
    const props = await seeded;
    const notes = await Promise.all(props.map((prop) => store.notes.get(prop.id)));

    // Cool, Base (uncoloured), Deep - see DESIGN.md's swatch names.
    expect(notes.map((note) => note?.color)).toEqual(['green', undefined, 'purple']);
  });

  it('writes bodies TipTap round-trips unchanged', async () => {
    const { store, seeded } = seed();
    const props = await seeded;
    const notes = await Promise.all(props.map((prop) => store.notes.get(prop.id)));

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

  it('records the baselines before the notes, so a crash mid-seed leaves no orphaned Prop', async () => {
    // The window this closes is not theoretical: the three notes appear on the
    // wall the instant they are written, and a reload before the baselines
    // followed them left all three there for good, with nothing to sweep by.
    const store = createMemoryLocalStore();
    const originalAdd = store.notes.add.bind(store.notes);
    let calls = 0;
    store.notes.add = async (note) => {
      calls += 1;
      if (calls === 2) throw new Error('interrupted');
      return originalAdd(note);
    };

    await expect(createProps(store, t)).rejects.toThrow('interrupted');

    // The baselines landed (written first); only the first note made it in.
    await expect(readProps(store)).resolves.toHaveLength(3);
    await expect(store.notes.list()).resolves.toHaveLength(1);
  });

  it('records the same baselines it returns', async () => {
    const { store, seeded } = seed();
    const props = await seeded;

    await expect(readProps(store)).resolves.toEqual(props);
  });

  it('opens the checklist with exactly one item already ticked', async () => {
    const { store, seeded } = seed();
    const [groceries] = await seeded;
    const note = await store.notes.get(groceries.id);
    const items = [...(note?.body ?? '').matchAll(/data-checked="(true|false)"/g)];

    expect(items.map(([, checked]) => checked)).toEqual(['true', 'false', 'false']);
  });
});

describe('purgeProps', () => {
  it('purges every untouched Prop', async () => {
    const { store, seeded } = seed();
    const props = await seeded;

    const purged = await purgeProps(store, purgeNoteFor(store), props);

    expect(purged).toHaveLength(3);
    await expect(store.notes.list()).resolves.toHaveLength(0);
  });

  it('leaves a Prop the user edited', async () => {
    const { store, seeded } = seed();
    const props = await seeded;

    // `updatedAt` has millisecond resolution and a test seeds and edits inside
    // one, so the clock has to move for the edit to be visible at all.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    await store.notes.update(props[0].id, () => ({
      body: '<p>mine now</p>',
      updatedAt: new Date().toISOString(),
    }));
    vi.useRealTimers();

    const purged = await purgeProps(store, purgeNoteFor(store), props);

    expect(purged).not.toContain(props[0].id);
    await expect(store.notes.get(props[0].id)).resolves.toBeDefined();
    await expect(store.notes.list()).resolves.toHaveLength(1);
  });

  it('still purges a Prop the Tour itself wrote to, once rebased', async () => {
    // The regression this whole design exists to prevent: the acts write too -
    // step 3 pins - so a baseline taken at seed time would make every Prop look
    // user-edited and nothing would ever be swept.
    const { store, seeded } = seed();
    const seededProps = await seeded;

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    await store.notes.update(seededProps[2].id, () => ({
      pinnedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    vi.useRealTimers();

    // Against the seed-time baseline the pin reads as an edit, which is what
    // would have left the Prop on the wall forever.
    expect(await purgeProps(store, purgeNoteFor(store), [seededProps[2]])).toEqual([]);

    const rebased = await rebaseProp(store, seededProps, seededProps[2].id);
    expect(await purgeProps(store, purgeNoteFor(store), rebased)).toHaveLength(3);
    await expect(store.notes.list()).resolves.toHaveLength(0);
  });

  it('sweeps an abandoned run on the next start', async () => {
    // A reload at step 2 ends the Tour with no teardown; the baselines survive
    // in the store's `meta` and the next start runs the same purge over them.
    const { store, seeded } = seed();
    const abandoned = await seeded;

    const purged = await purgeProps(store, purgeNoteFor(store), abandoned);

    expect(purged).toHaveLength(3);
    await expect(store.notes.list()).resolves.toHaveLength(0);
  });

  it('tolerates a Prop the user deleted themselves', async () => {
    const { store, seeded } = seed();
    const props = await seeded;
    await store.notes.purge(props[1].id);

    const purged = await purgeProps(store, purgeNoteFor(store), props);

    expect(purged).toEqual([props[0].id, props[2].id]);
    await expect(store.notes.list()).resolves.toHaveLength(0);
  });

  it('cascades a Prop’s relationships, because it purges rather than trashes', async () => {
    const { store, seeded } = seed();
    const props = await seeded;
    const now = new Date().toISOString();
    await store.tags.link({ noteId: props[0].id, tagId: 'tag-1', createdAt: now, updatedAt: now });

    await purgeProps(store, purgeNoteFor(store), props);

    await expect(store.tags.listLinks()).resolves.toHaveLength(0);
  });
});

describe('propByKey', () => {
  it('finds the Prop the steps name, which is the one they open and pin', async () => {
    const { store, seeded } = seed();
    const props = await seeded;

    const ideas = propByKey(props, 'ideas');

    const note = await store.notes.get(ideas?.id ?? '');
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
    const { store, seeded } = seed();
    const props = await seeded;

    const updated = await store.notes.update(props[0].id, () => ({ header: 'x' }));
    const rebased = await rebaseProp(store, props, props[0].id);

    expect(rebased[0].updatedAt).toBe(updated?.after.updatedAt);
    expect(rebased.slice(1)).toEqual(props.slice(1));
  });

  it('leaves the list alone when the Prop is gone', async () => {
    const { store, seeded } = seed();
    const props = await seeded;
    await store.notes.purge(props[0].id);

    await expect(rebaseProp(store, props, props[0].id)).resolves.toEqual(props);
  });
});
