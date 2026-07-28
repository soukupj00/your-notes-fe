import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import { clearNotesDb } from '@/test/db.ts';
import LabelsPage from './labels.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

async function putTag(id: string, name: string, color?: string) {
  const now = new Date().toISOString();
  await db.tags.put({ id, name, color, createdAt: now, updatedAt: now });
}

const link = async (noteId: string, tagId: string) => {
  const now = new Date().toISOString();
  await db.noteTags.put({ noteId, tagId, createdAt: now, updatedAt: now });
};

const linkedNoteIds = async (tagId: string) =>
  (await db.noteTags.where('tagId').equals(tagId).toArray()).map((l) => l.noteId).sort();

afterEach(clearNotesDb);

describe('listing', () => {
  it('says so when there are no labels', async () => {
    render(<LabelsPage />);
    expect(await screen.findByText('labels.empty')).toBeInTheDocument();
  });

  it('creates a label from the new-label row', async () => {
    render(<LabelsPage />);

    await userEvent.type(screen.getByRole('textbox', { name: 'labels.namePlaceholder' }), 'Work');
    await userEvent.click(screen.getByRole('button', { name: 'labels.create' }));

    await waitFor(async () => expect(await db.tags.count()).toBe(1));
    expect((await db.tags.toArray())[0]).toMatchObject({ name: 'Work' });
  });
});

describe('renaming', () => {
  it('commits the new name on blur', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    const field = await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Job');
    await userEvent.tab();

    await waitFor(async () => expect((await db.tags.get('t1'))?.name).toBe('Job'));
  });

  it('snaps back rather than saving an empty name', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    const field = await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    await userEvent.clear(field);
    await userEvent.tab();

    expect(field).toHaveValue('Work');
    expect((await db.tags.get('t1'))?.name).toBe('Work');
  });
});

describe('colour', () => {
  it('assigns a palette colour from the swatch popover', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.color:Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect((await db.tags.get('t1'))?.color).toBe('blue'));
  });

  it('clears the colour with the "no colour" swatch', async () => {
    await putTag('t1', 'Work', 'blue');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.color:Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.default' }));

    await waitFor(async () => expect((await db.tags.get('t1'))?.color).toBeUndefined());
  });
});

describe('deleting', () => {
  it('detaches the label from its notes once confirmed', async () => {
    await putTag('t1', 'Work');
    await link('n1', 't1');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.delete:Work' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'labels.confirmDelete.confirm' })
    );

    await waitFor(async () => expect(await db.tags.get('t1')).toBeUndefined());
    expect(await db.noteTags.count()).toBe(0);
  });

  it('does nothing when the confirm is cancelled', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.delete:Work' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'labels.confirmDelete.cancel' })
    );

    expect(await db.tags.get('t1')).toBeDefined();
  });
});

describe('merging', () => {
  it('moves the source label’s notes onto the chosen target', async () => {
    await putTag('t1', 'Job');
    await putTag('t2', 'Work');
    await link('n1', 't1');
    await link('n2', 't2');
    render(<LabelsPage />);

    // The merge control on the "Job" row lists every other label as a target.
    const row = (await screen.findByRole('textbox', { name: 'labels.rename:Job' })).closest('li');
    if (!row) throw new Error('label row not found');
    await userEvent.click(within(row).getByRole('button', { name: 'labels.merge' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Work' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'labels.confirmMerge.confirm' })
    );

    await waitFor(async () => expect(await db.tags.get('t1')).toBeUndefined());
    expect(await linkedNoteIds('t2')).toEqual(['n1', 'n2']);
  });

  it('offers no merge control when there is only one label', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    expect(screen.queryByRole('button', { name: 'labels.merge' })).not.toBeInTheDocument();
  });
});
