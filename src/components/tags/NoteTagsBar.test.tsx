import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteTagsBar } from './NoteTagsBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Interpolate, so "Create 'x'" and "Remove label x" stay distinguishable.
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
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

/** Open the "＋ Label" popover and hand back its content. */
async function openPopover() {
  await userEvent.click(await screen.findByRole('button', { name: 'tags.add' }));
  return screen.findByRole('dialog');
}

afterEach(clearStore);

describe('assigning labels', () => {
  it('ticks an existing label onto the note', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar noteId="n1" />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
  });

  it('unticks a label off the note', async () => {
    await putTag('t1', 'Work');
    const now = new Date().toISOString();
    await testStore.tags.link({ noteId: 'n1', tagId: 't1', createdAt: now, updatedAt: now });
    render(<NoteTagsBar noteId="n1" />);

    const popover = await openPopover();
    await waitFor(() =>
      expect(within(popover).getByRole('checkbox', { name: 'Work' })).toBeChecked()
    );
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual([]));
  });

  it('toggles from a click on the label text, not just the box', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar noteId="n1" />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByText('Work'));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual(['t1']));
  });

  it('filters the list and creates the typed label on the fly', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar noteId="n1" />);

    const popover = await openPopover();
    await userEvent.type(within(popover).getByRole('textbox'), 'Home');

    // The non-matching existing label drops out of the list...
    expect(within(popover).queryByRole('checkbox', { name: 'Work' })).not.toBeInTheDocument();
    // ...and the create row offers exactly what was typed.
    await userEvent.click(within(popover).getByRole('button', { name: 'tags.create:Home' }));

    await waitFor(async () => expect((await testStore.tags.list()).length).toBe(2));
    const created = (await testStore.tags.list()).find((tag) => tag.name === 'Home');
    expect(await linkedTagIds('n1')).toEqual([created?.id]);
  });

  it('offers no create row for a name that already exists', async () => {
    await putTag('t1', 'Work');
    render(<NoteTagsBar noteId="n1" />);

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

    render(<NoteTagsBar noteId="n1" />);

    expect(await screen.findByText('Work')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'tags.remove:Work' }));

    await waitFor(async () => expect(await linkedTagIds('n1')).toEqual([]));
  });
});

describe('unsaved drafts', () => {
  it('persists the draft through ensureNoteId before labelling it', async () => {
    await putTag('t1', 'Work');
    const ensureNoteId = vi.fn().mockResolvedValue('created-note');

    render(<NoteTagsBar noteId={null} ensureNoteId={ensureNoteId} />);

    const popover = await openPopover();
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect(await linkedTagIds('created-note')).toEqual(['t1']));
    expect(ensureNoteId).toHaveBeenCalledTimes(1);
    // Wait on the checkbox itself, not the database, before the second click:
    // the DB write can resolve a render ahead of the checkbox's own `checked`
    // update, and a second click that lands in that gap toggles it from its
    // still-unchecked state instead of the checked one it is meant to undo.
    await waitFor(() =>
      expect(within(popover).getByRole('checkbox', { name: 'Work' })).toBeChecked()
    );

    // The resolved id is remembered: a second change must not create again.
    await userEvent.click(within(popover).getByRole('checkbox', { name: 'Work' }));
    await waitFor(async () => expect(await linkedTagIds('created-note')).toEqual([]));
    expect(ensureNoteId).toHaveBeenCalledTimes(1);
  });
});
