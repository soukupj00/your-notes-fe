import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import { clearNotesDb } from '@/test/db.ts';
import { renderRoute } from '@/test/renderRoute.tsx';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: () => null,
  EMPTY_CHECKLIST_BODY: '',
}));

const MOBILE_WIDTH = 500;

beforeEach(() => {
  window.innerWidth = MOBILE_WIDTH;
});

afterEach(async () => {
  localStorage.clear();
  await clearNotesDb();
});

const back = () => screen.findByRole('button', { name: 'nav.back' });
const appBar = () => document.querySelector('[data-slot="app-bar"]') as HTMLElement;

describe('the topbar left slot', () => {
  it('is the drawer trigger on a feed', async () => {
    renderRoute('/');

    // The desktop row renders too (it is hidden with CSS, which jsdom does not
    // apply), so scope to the mobile app bar rather than to the document.
    await waitFor(() => expect(appBar()).not.toBeNull());
    expect(within(appBar()).getByRole('button', { name: 'nav.toggle' })).toBeInTheDocument();
    expect(within(appBar()).queryByRole('button', { name: 'nav.back' })).not.toBeInTheDocument();
  });

  it('is back on a page, which gives up the drawer', async () => {
    renderRoute('/settings');

    await waitFor(() => expect(appBar()).not.toBeNull());
    expect(within(appBar()).getByRole('button', { name: 'nav.back' })).toBeInTheDocument();
    // Deliberate: the settings stack is somewhere you exit, not a peer of the
    // feeds, so it trades the drawer for a way out.
    expect(within(appBar()).queryByRole('button', { name: 'nav.toggle' })).not.toBeInTheDocument();
  });
});

describe('BackButton', () => {
  it('returns where you actually came from when there is history', async () => {
    // Deliberately not `/`: the fallback parent is `/`, so a test that arrives
    // from there cannot tell the two branches apart.
    const router = renderRoute(['/archive', '/settings']);

    await userEvent.click(await back());

    await waitFor(() => expect(router.state.location.pathname).toBe('/archive'));
  });

  // The branch manual testing never reaches: a cold entry has nothing to pop,
  // and popping there would leave the app - which on an installed iOS PWA means
  // the user has no way back in except relaunching it.
  it('falls back to the parent on a cold entry', async () => {
    const router = renderRoute('/settings');

    await userEvent.click(await back());

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('walks the settings stack one level at a time when cold', async () => {
    const router = renderRoute('/settings/labels');

    await userEvent.click(await back());

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
  });
});

describe('the topbar title', () => {
  it('names the feeds that are otherwise indistinguishable', async () => {
    renderRoute('/archive');

    await waitFor(() => expect(appBar()).not.toBeNull());
    expect(within(appBar()).getByText('nav.archive')).toBeInTheDocument();
  });

  // `/` is the default surface and says so by carrying the search box instead.
  it('leaves the default feed untitled', async () => {
    renderRoute('/');

    await waitFor(() => expect(appBar()).not.toBeNull());
    expect(within(appBar()).queryByText('nav.notes')).not.toBeInTheDocument();
    expect(within(appBar()).getByRole('searchbox')).toBeInTheDocument();
  });

  it('resolves a tag route to the tag name', async () => {
    const now = new Date().toISOString();
    await db.tags.put({ id: 't1', name: 'Work', color: 'blue', createdAt: now, updatedAt: now });

    renderRoute('/tag/t1');

    await waitFor(() => expect(within(appBar()).getByText('Work')).toBeInTheDocument());
  });

  // With a title in the middle the search box drops to its own row, so it stays
  // full-bleed rather than being squeezed between two 44px controls.
  it('moves the search box out of the bar when there is a title', async () => {
    renderRoute('/archive');

    await waitFor(() => expect(appBar()).not.toBeNull());
    expect(within(appBar()).queryByRole('searchbox')).not.toBeInTheDocument();
    // Still on the route, just below the bar - and still exactly one of them.
    expect(screen.getAllByRole('searchbox')).toHaveLength(2); // desktop row + mobile row
  });
});
