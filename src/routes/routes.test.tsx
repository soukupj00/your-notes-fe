import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotesProvider } from '@/context/NotesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { routeTree } from '@/routeTree.gen';
import { clearNotesDb } from '@/test/db.ts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The Navbar reads i18n directly for the locale switcher.
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

// The editor pulls in TipTap/Excalidraw, which this suite does not exercise.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: () => null,
  EMPTY_CHECKLIST_BODY: '',
}));

// Cards render the note header; that is all these tests assert on.
vi.mock('@/components/cards/NoteCard.tsx', () => ({
  NoteCard: ({ note }: { note: Note }) => <div data-testid="note-card">{note.header}</div>,
}));

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

async function seed() {
  const now = new Date().toISOString();
  const base = { body: '', createdAt: now, updatedAt: now };
  await db.notes.bulkPut([
    { id: 'n-active', header: 'Active note', state: 'active', ...base },
    { id: 'n-archived', header: 'Archived note', state: 'archived', ...base },
    { id: 'n-trashed', header: 'Trashed note', state: 'trashed', trashedAt: daysAgo(1), ...base },
  ]);
}

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <ThemeProvider>
      <ViewModeProvider>
        <NotesProvider>
          {/* biome-ignore lint/suspicious/noExplicitAny: the test router is not the app's registered one */}
          <RouterProvider router={router as any} />
        </NotesProvider>
      </ViewModeProvider>
    </ThemeProvider>
  );
  return router;
}

afterEach(clearNotesDb);

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
    await db.notes.put({
      id: 'n-tagged',
      header: 'Tagged note',
      body: '',
      state: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await db.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });
    await db.noteTags.put({ noteId: 'n-tagged', tagId: 't1', createdAt: now, updatedAt: now });

    renderAt('/tag/t1');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    expect(screen.getByTestId('note-card')).toHaveTextContent('Tagged note');
    // The tag name is the page heading.
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
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
    await db.tags.put({ id: 't1', name: 'Work', color: 'blue', createdAt: now, updatedAt: now });

    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'nav.primary' });
    const link = await within(nav).findByRole('link', { name: 'Work' });
    expect(link).toHaveAttribute('href', '/tag/t1');
  });
});

describe('settings page', () => {
  afterEach(() => localStorage.clear());

  it('switches the theme from the appearance section', async () => {
    renderAt('/settings');

    // Radix ToggleGroup 1.1.19 exposes a single-select root as `radiogroup`
    // (it was `group` before), which matches the `radio` items queried below.
    const themes = await screen.findByRole('radiogroup', { name: 'settings.theme.label' });
    await userEvent.click(within(themes).getByRole('radio', { name: 'settings.theme.light' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(localStorage.getItem('vite-ui-theme')).toBe('light');
  });

  it('links to the manage-labels view', async () => {
    renderAt('/settings');

    // Scoped to the page: the sidebar carries its own "Edit labels" link.
    const link = await within(await screen.findByRole('main')).findByRole('link', {
      name: 'nav.editLabels',
    });
    expect(link).toHaveAttribute('href', '/settings/labels');
  });
});

describe('trash view', () => {
  it('empties the trash without touching the other views', async () => {
    await seed();
    renderAt('/trash');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'notes.emptyTrash' }));

    await waitFor(async () => expect(await db.notes.get('n-trashed')).toBeUndefined());
    expect(await db.notes.get('n-active')).toBeTruthy();
    expect(await db.notes.get('n-archived')).toBeTruthy();
  });
});
