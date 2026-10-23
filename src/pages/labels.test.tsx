import { render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Toaster } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import type { NoteState } from '@/models.ts';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import LabelsPage from './labels.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string; count?: number }) =>
      opts?.name ? `${key}:${opts.name}` : opts?.count === undefined ? key : `${key}:${opts.count}`,
    i18n: { language: 'en' },
  }),
}));

const render = (ui: ReactElement) =>
  rtlRender(
    <PreferencesProvider>
      {withStore(ui)}
      <Toaster />
    </PreferencesProvider>
  );

async function putTag(id: string, name: string, color?: string, position?: string) {
  const now = new Date().toISOString();
  await testStore.tags.put({ id, name, color, position, createdAt: now, updatedAt: now });
}

async function putNote(id: string, state: NoteState) {
  const now = new Date().toISOString();
  await testStore.notes.add({ id, state, createdAt: now, updatedAt: now });
}

const rowNames = () =>
  screen
    .getAllByRole('textbox', { name: /^labels\.rename:/ })
    .map((field) => (field as HTMLInputElement).value);

const link = async (noteId: string, tagId: string) => {
  const now = new Date().toISOString();
  await testStore.tags.link({ noteId, tagId, createdAt: now, updatedAt: now });
};

const linkedNoteIds = async (tagId: string) =>
  (await testStore.tags.listLinks())
    .filter((l) => l.tagId === tagId)
    .map((l) => l.noteId)
    .sort();

afterEach(clearStore);

describe('listing', () => {
  it('says so when there are no labels', async () => {
    render(<LabelsPage />);
    expect(await screen.findByText('labels.empty')).toBeInTheDocument();
  });

  it('creates a label from the new-label row', async () => {
    render(<LabelsPage />);

    await userEvent.type(screen.getByRole('textbox', { name: 'labels.namePlaceholder' }), 'Work');
    await userEvent.click(screen.getByRole('button', { name: 'labels.create' }));

    await waitFor(async () => expect((await testStore.tags.list()).length).toBe(1));
    expect((await testStore.tags.list())[0]).toMatchObject({ name: 'Work' });
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

    await waitFor(async () => expect((await testStore.tags.get('t1'))?.name).toBe('Job'));
  });

  it('snaps back rather than saving an empty name', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    const field = await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    await userEvent.clear(field);
    await userEvent.tab();

    expect(field).toHaveValue('Work');
    expect((await testStore.tags.get('t1'))?.name).toBe('Work');
  });
});

describe('colour', () => {
  it('assigns a palette colour from the swatch popover', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.color:Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect((await testStore.tags.get('t1'))?.color).toBe('blue'));
  });

  it('clears the colour with the "no colour" swatch', async () => {
    await putTag('t1', 'Work', 'blue');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.color:Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.default' }));

    await waitFor(async () => expect((await testStore.tags.get('t1'))?.color).toBeUndefined());
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

    await waitFor(async () => expect(await testStore.tags.get('t1')).toBeUndefined());
    expect((await testStore.tags.listLinks()).length).toBe(0);
  });

  it('does nothing when the confirm is cancelled', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'labels.delete:Work' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'labels.confirmDelete.cancel' })
    );

    expect(await testStore.tags.get('t1')).toBeDefined();
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
    await userEvent.click(within(row).getByRole('button', { name: 'labels.mergeInto' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Work' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'labels.confirmMerge.confirm' })
    );

    await waitFor(async () => expect(await testStore.tags.get('t1')).toBeUndefined());
    expect(await linkedNoteIds('t2')).toEqual(['n1', 'n2']);
  });

  it('offers no merge control when there is only one label', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    expect(screen.queryByRole('button', { name: 'labels.mergeInto' })).not.toBeInTheDocument();
  });
});

describe('label order', () => {
  it('every row has a drag handle named after its label', async () => {
    await putTag('t1', 'Beta');
    await putTag('t2', 'Alpha');
    render(<LabelsPage />);

    await screen.findByRole('textbox', { name: 'labels.rename:Beta' });
    expect(
      screen.getAllByRole('button', { name: /^labels\.dragHandle:/ }).map((h) => h.ariaLabel)
    ).toEqual(['labels.dragHandle:Alpha', 'labels.dragHandle:Beta']);
  });

  it('Space in a name field types a space and lifts nothing', async () => {
    await putTag('t1', 'Work');
    render(<LabelsPage />);

    const field = await screen.findByRole('textbox', { name: 'labels.rename:Work' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Home office');
    expect(document.querySelector('[data-dragging]')).toBeNull();
    expect(screen.getByRole('button', { name: /^labels\.dragHandle:/ })).not.toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await userEvent.tab();

    await waitFor(async () => expect((await testStore.tags.get('t1'))?.name).toBe('Home office'));
  });

  it('Arrange A to Z reorders, toasts, and Undo puts the order back', async () => {
    await putTag('t1', 'Beta', undefined, 'a0');
    await putTag('t2', 'Alpha', undefined, 'a1');
    render(<LabelsPage />);
    await screen.findByRole('textbox', { name: 'labels.rename:Beta' });
    expect(rowNames()).toEqual(['Beta', 'Alpha']);

    await userEvent.click(screen.getByRole('button', { name: 'labels.arrange.label' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'labels.arrange.az' }));

    await waitFor(() => expect(rowNames()).toEqual(['Alpha', 'Beta']));
    expect(await screen.findByText('labels.arrange.done_az')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'notes.undo' }));
    await waitFor(() => expect(rowNames()).toEqual(['Beta', 'Alpha']));
  });
});

describe('the row', () => {
  it("shows each label's note count, and how many labels there are", async () => {
    await putTag('t1', 'Work');
    await putTag('t2', 'Idle');
    await putNote('n1', 'active');
    await putNote('n2', 'archived');
    await putNote('n3', 'trashed');
    for (const id of ['n1', 'n2', 'n3']) await link(id, 't1');
    render(<LabelsPage />);

    expect(await screen.findByText('labels.count:2')).toBeInTheDocument();
    const row = (await screen.findByRole('textbox', { name: 'labels.rename:Work' })).closest('li');
    if (!row) throw new Error('label row not found');
    expect(await within(row).findByText('labels.noteCount:2')).toBeInTheDocument();
    const idle = screen.getByRole('textbox', { name: 'labels.rename:Idle' }).closest('li');
    expect(within(idle as HTMLElement).getByText('labels.noteCount:0')).toBeInTheDocument();
  });

  it('Merge is an icon button named "Merge into…" that opens the list of other labels', async () => {
    await putTag('t1', 'Job');
    await putTag('t2', 'Work');
    render(<LabelsPage />);

    const row = (await screen.findByRole('textbox', { name: 'labels.rename:Job' })).closest('li');
    if (!row) throw new Error('label row not found');
    const merge = within(row).getByRole('button', { name: 'labels.mergeInto' });
    expect(merge).not.toHaveTextContent('labels');

    await userEvent.click(merge);
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
      'Work',
    ]);
  });

  it('a created label is highlighted where it lands', async () => {
    await putTag('t1', 'Alpha');
    render(<LabelsPage />);

    await userEvent.type(screen.getByRole('textbox', { name: 'labels.namePlaceholder' }), 'Beta');
    await userEvent.click(screen.getByRole('button', { name: 'labels.create' }));

    const field = await screen.findByRole('textbox', { name: 'labels.rename:Beta' });
    const row = field.closest('li');
    await waitFor(() => expect(row).toHaveAttribute('data-just-created'));
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(row);
    const alpha = screen.getByRole('textbox', { name: 'labels.rename:Alpha' }).closest('li');
    expect(alpha).not.toHaveAttribute('data-just-created');
  });
});
