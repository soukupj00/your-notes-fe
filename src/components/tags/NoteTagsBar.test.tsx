import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag } from '@/models.ts';
import { testDraft } from '@/test/draft.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteTagsBar } from './NoteTagsBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Interpolate, so "Create 'x'" and "Remove label x" stay distinguishable.
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
    i18n: { language: 'en' },
  }),
}));

async function putTag(id: string, name: string): Promise<Tag> {
  const now = new Date().toISOString();
  const tag = { id, name, createdAt: now, updatedAt: now };
  await testStore.tags.put(tag);
  return tag;
}

const linkedTagIds = async (noteId: string) =>
  (await testStore.tags.listLinks())
    .filter((link) => link.noteId === noteId)
    .map((link) => link.tagId)
    .sort();

/** An open Note whose row exists, so labelling it writes nothing but the link. */
const openNote = () => testDraft({ id: 'n1', isNew: false });

/** Open the "＋ Label" popover and hand back its content. */
async function openPopover() {
  await userEvent.click(await screen.findByRole('button', { name: 'tags.add' }));
  return screen.findByRole('dialog');
}

afterEach(clearStore);

describe('assigning labels', () => {
  it('ticks an existing label onto the note', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar draft={openNote()} />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
  });

  it('unticks a label off the note', async () => {
    await putTag('t1', 'Work');
    const now = new Date().toISOString();
    await testStore.tags.link({ noteId: 'n1', tagId: 't1', createdAt: now, updatedAt: now });
    render(<NoteTagsBar draft={openNote()} />);

    const popover = await openPopover();
    await waitFor(() =>
      expect(within(popover).getByRole('checkbox', { name: 'Work' })).toBeChecked()
    );
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual([]));
  });

  it('toggles from a click on the label text, not just the box', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar draft={openNote()} />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByText('Work'));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
  });

  it('filters the list and creates the typed label on the fly', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar draft={openNote()} />);

    const popover = await openPopover();
    await userEvent.type(within(popover).getByRole('textbox'), 'Home');

    expect(within(popover).queryByRole('checkbox', { name: 'Work' })).not.toBeInTheDocument();
    await userEvent.click(within(popover).getByRole('button', { name: 'tags.create:Home' }));

    await waitFor(async () => expect((await testStore.tags.list()).length).toBe(2));
    const created = (await testStore.tags.list()).find((tag) => tag.name === 'Home');
    expect(await linkedTagIds('n1')).toEqual([created?.id]);
  });

  it('offers no create row for a name that already exists', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar draft={openNote()} />);

    const popover = await openPopover();
    await userEvent.type(within(popover).getByRole('textbox'), 'work');

    expect(within(popover).queryByRole('button', { name: /tags.create/ })).not.toBeInTheDocument();
  });
});

describe('assigned pills', () => {
  it('renders the note’s labels and removes one on click', async () => {
    await putTag('t1', 'Work');
    const now = new Date().toISOString();
    await testStore.tags.link({ noteId: 'n1', tagId: 't1', createdAt: now, updatedAt: now });

    render(<NoteTagsBar draft={openNote()} />);

    expect(await screen.findByText('Work')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'tags.remove:Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual([]));
  });
});

describe('a new Draft', () => {
  it('earns its row before it is labelled, and shows the label under its id', async () => {
    await putTag('t1', 'Work');
    // Recorded, not asserted, inside the stub: a throw there would only reject `ensureSaved`.
    let linksAtCreate: string[] | undefined;
    const createNote = vi.fn(async () => {
      linksAtCreate = await linkedTagIds('n1');
    });

    render(<NoteTagsBar draft={testDraft({ id: 'n1', isNew: true }, { createNote })} />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
    expect(createNote).toHaveBeenCalledOnce();
    // The row came first: no link existed yet when it was created.
    expect(linksAtCreate).toEqual([]);
    await waitFor(() =>
      expect(within(popover).getByRole('checkbox', { name: 'Work' })).toBeChecked()
    );

    // The bar queries the Draft's id from the start, so the pill needs no second id to appear.
    // The popover is modal and hides the bar from role queries while open, so it closes first.
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'tags.remove:Work' })).toBeInTheDocument();
  });

  // The dialog moves the bar between the Editor's footer and its own body when the width crosses
  // `sm` (a phone turning), which remounts it. The pills used to vanish then, because the bar kept
  // its own copy of the id, seeded null; querying the Draft's id from the start fixes that.
  it('keeps its pills across a remount', async () => {
    await putTag('t1', 'Work');
    const draft = testDraft({ id: 'n1', isNew: true }, { createNote: async () => {} });
    const { unmount } = render(<NoteTagsBar draft={draft} />);
    const popover = await openPopover();
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));
    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
    unmount();

    render(<NoteTagsBar draft={draft} />);

    expect(await screen.findByRole('button', { name: 'tags.remove:Work' })).toBeInTheDocument();
  });
});
