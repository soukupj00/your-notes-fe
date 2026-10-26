import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { renderRoute as renderAt } from '@/test/renderRoute.tsx';
import { clearStore, testStore } from '@/test/store.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  // The Navbar reads i18n directly for the locale switcher.
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

// The editor pulls in TipTap/Excalidraw, which this suite does not exercise.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: () => null,
}));

// Cards render the note header; that is all these tests assert on.
vi.mock('@/components/cards/NoteCard.tsx', () => ({
  NoteCard: ({ note }: { note: Note }) => <div data-testid="note-card">{note.header}</div>,
}));

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

async function seed() {
  const now = new Date().toISOString();
  const base = { body: '', createdAt: now, updatedAt: now };
  const notes: Note[] = [
    { id: 'n-active', header: 'Active note', state: 'active', ...base },
    { id: 'n-archived', header: 'Archived note', state: 'archived', ...base },
    { id: 'n-trashed', header: 'Trashed note', state: 'trashed', trashedAt: daysAgo(1), ...base },
  ];
  for (const note of notes) await testStore.notes.put(note);
}

afterEach(clearStore);

describe('route -> note set', () => {
  it.each([
    ['/', 'Active note'],
    ['/archive', 'Archived note'],
    ['/trash', 'Trashed note'],
  ])('%s shows only its own notes', async (path, expected) => {
    await seed();
    renderAt(path);

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    expect(screen.getByTestId('note-card')).toHaveTextContent(expected);
  });

  it('/tag/$id shows only the active notes carrying that tag', async () => {
    await seed();
    const now = new Date().toISOString();
    await testStore.notes.put({
      id: 'n-tagged',
      header: 'Tagged note',
      body: '',
      state: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await testStore.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });
    await testStore.tags.link({ noteId: 'n-tagged', tagId: 't1', createdAt: now, updatedAt: now });

    renderAt('/tag/t1');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    expect(screen.getByTestId('note-card')).toHaveTextContent('Tagged note');
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
  });
});

describe('search state in the URL', () => {
  async function seedSearchable() {
    const now = new Date().toISOString();
    const base = { body: '', state: 'active' as const, createdAt: now, updatedAt: now };
    for (const note of [
      { id: 'n-cake', header: 'Cake recipe', ...base },
      { id: 'n-car', header: 'Car service', ...base },
    ]) {
      await testStore.notes.put(note);
    }
    await testStore.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });
    await testStore.tags.link({ noteId: 'n-car', tagId: 't1', createdAt: now, updatedAt: now });
  }

  it('applies a query taken straight from the address bar', async () => {
    await seedSearchable();
    renderAt('/?q=cake');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    expect(screen.getByTestId('note-card')).toHaveTextContent('Cake recipe');
    // The box is populated from the URL, so a refresh keeps the search visible.
    // Two of them: the Navbar renders a desktop and a mobile variant.
    for (const box of await screen.findAllByRole('searchbox')) {
      expect(box).toHaveValue('cake');
    }
  });

  it('writes what the user types into the URL', async () => {
    await seedSearchable();
    const router = renderAt('/');

    await userEvent.type((await screen.findAllByRole('searchbox'))[0], 'cake');

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'cake' }));
    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
  });

  it('writes the chosen sort order into the URL and reorders the feed', async () => {
    await seedSearchable();
    const router = renderAt('/');

    await userEvent.click((await screen.findAllByRole('button', { name: 'notes.sort.label' }))[0]);
    const fields = await screen.findByRole('radiogroup', { name: 'notes.sort.byLabel' });
    await userEvent.click(within(fields).getByRole('radio', { name: 'notes.sort.field.title' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'title' }));
    await waitFor(() =>
      expect(screen.getAllByTestId('note-card').map((el) => el.textContent)).toEqual([
        'Car service',
        'Cake recipe',
      ])
    );
  });

  it('toggles a tag pill into the URL and narrows the results', async () => {
    await seedSearchable();
    const router = renderAt('/?q=ca');

    await userEvent.click(await screen.findByRole('button', { name: 'Work', pressed: false }));

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'ca', tags: ['t1'] }));
    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    expect(screen.getByTestId('note-card')).toHaveTextContent('Car service');
  });

  it('offers no label filters until a search is under way', async () => {
    await seedSearchable();
    renderAt('/');

    await screen.findAllByTestId('note-card');
    expect(screen.queryByRole('button', { name: 'Work' })).not.toBeInTheDocument();
  });

  it('hides the search box on a route with no feed to search', async () => {
    renderAt('/settings');

    await screen.findByRole('heading', { level: 1, name: 'nav.settings' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('quick capture', () => {
  it('offers a media start for each capture kind beside the note bar', async () => {
    renderAt('/');

    await screen.findByRole('heading', { level: 1, name: 'nav.notes' });
    // Plain text is the bar itself; the icons cover the four media starts.
    for (const key of ['checklist', 'audio', 'drawing', 'picture']) {
      expect(screen.getByRole('button', { name: `notes.capture.${key}` })).toBeInTheDocument();
    }
  });

  it('does not offer quick capture in the archive or the trash', async () => {
    renderAt('/archive');

    await screen.findByRole('heading', { level: 1, name: 'nav.archive' });
    expect(screen.queryByRole('button', { name: 'notes.capture.audio' })).not.toBeInTheDocument();
  });
});

describe('nav shell', () => {
  it('navigates between views from the sidebar', async () => {
    await seed();
    const router = renderAt('/');

    await screen.findByRole('heading', { level: 1, name: 'nav.notes' });

    const nav = await screen.findByRole('navigation', { name: 'nav.primary' });
    await userEvent.click(within(nav).getByRole('link', { name: 'nav.archive' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/archive'));
    expect(await screen.findByRole('heading', { level: 1, name: 'nav.archive' })).toBeVisible();
  });

  it('moves focus to the destination heading on navigation', async () => {
    await seed();
    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'nav.primary' });
    await userEvent.click(within(nav).getByRole('link', { name: 'nav.trash' }));

    // Focus must land on the new view's h1, not stay on the link that was clicked.
    const heading = await screen.findByRole('heading', { level: 1, name: 'nav.trash' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('lists each tag as a link to its own feed', async () => {
    const now = new Date().toISOString();
    await testStore.tags.put({
      id: 't1',
      name: 'Work',
      color: 'blue',
      createdAt: now,
      updatedAt: now,
    });

    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'nav.primary' });
    const link = await within(nav).findByRole('link', { name: 'Work' });
    expect(link).toHaveAttribute('href', '/tag/t1');
  });
});

describe('settings page', () => {
  afterEach(() => localStorage.clear());

  it('switches the theme from the appearance section', async () => {
    renderAt('/settings/general');

    // Radix ToggleGroup 1.1.19 exposes a single-select root as `radiogroup`
    // (it was `group` before), which matches the `radio` items queried below.
    const themes = await screen.findByRole('radiogroup', { name: 'settings.theme.label' });
    await userEvent.click(within(themes).getByRole('radio', { name: 'settings.theme.light' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(localStorage.getItem('vite-ui-theme')).toBe('light');
  });

  it('leaves the Account page for Settings when no account is signed in', async () => {
    const router = renderAt('/settings/account');

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
  });
});

describe('trash view', () => {
  it('empties the trash without touching the other views', async () => {
    await seed();
    renderAt('/trash');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'notes.emptyTrash' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmEmptyTrash.confirm' })
    );

    await waitFor(async () => expect(await testStore.notes.get('n-trashed')).toBeUndefined());
    expect(await testStore.notes.get('n-active')).toBeTruthy();
    expect(await testStore.notes.get('n-archived')).toBeTruthy();
  });

  it('asks first, and cancelling keeps the trash', async () => {
    await seed();
    renderAt('/trash');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'notes.emptyTrash' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmEmptyTrash.cancel' })
    );

    expect(await testStore.notes.get('n-trashed')).toBeTruthy();
  });
});
