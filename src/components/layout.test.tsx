import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS } from '@/components/nav/navItems.ts';
import { FLOATING_BOTTOM_BAR_CLEARANCE } from '@/components/notes/floatingBottomBar.ts';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore, testStore } from '@/test/store.tsx';
import { setViewport } from '@/test/viewport.ts';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'navbar.logo' ? 'YourNotes' : key),
    i18n: { language: 'en' },
  }),
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

const DESKTOP_WIDTH = 1024;
/** `useIsMobile` reads its query synchronously, so this must be set pre-render. */
function setViewportWidth(width: number) {
  setViewport(width);
}

async function seedTag() {
  const now = new Date().toISOString();
  await testStore.tags.put({
    id: 't1',
    name: 'Work',
    color: 'blue',
    createdAt: now,
    updatedAt: now,
  });
}

const primaryNav = () => screen.findByRole('navigation', { name: 'nav.primary' });

beforeEach(() => setViewportWidth(DESKTOP_WIDTH));

afterEach(async () => {
  localStorage.clear();
  await clearStore();
});

describe('nav shell contents', () => {
  it('renders the YourNotes brand as a link to the feed', async () => {
    renderRoute('/archive');

    const brand = await screen.findByRole('link', { name: 'YourNotes' });
    expect(brand).toHaveAttribute('href', '/');
    expect(brand.querySelector('.bg-primary')).not.toBeNull();
  });

  it('renders every destination and every tag as a link', async () => {
    await seedTag();
    renderRoute('/');

    const nav = within(await primaryNav());
    for (const { to, labelKey } of NAV_ITEMS) {
      expect(nav.getByRole('link', { name: labelKey })).toHaveAttribute('href', to);
    }
    expect(await nav.findByRole('link', { name: 'Work' })).toHaveAttribute('href', '/tag/t1');
  });

  it('keeps settings out of the primary sidebar', async () => {
    renderRoute('/');

    const nav = within(await primaryNav());
    expect(nav.queryByRole('link', { name: 'nav.settings' })).not.toBeInTheDocument();
  });

  it('keeps every destination and every label as a named link when collapsed', async () => {
    await seedTag();
    localStorage.setItem('sidebar-open', 'false');
    renderRoute('/');

    const nav = within(await primaryNav());
    for (const { to, labelKey } of NAV_ITEMS) {
      expect(nav.getByRole('link', { name: labelKey })).toHaveAttribute('href', to);
    }
    expect(await nav.findByRole('link', { name: 'Work' })).toHaveAttribute('href', '/tag/t1');
  });

  it('names a label in a tooltip only while the rail is collapsed', async () => {
    await seedTag();
    localStorage.setItem('sidebar-open', 'false');
    renderRoute('/');

    await userEvent.hover(await within(await primaryNav()).findByRole('link', { name: 'Work' }));

    expect(await screen.findByRole('tooltip', { name: 'Work' })).toBeInTheDocument();
  });
});

// The sidebar lists every destination *and* every label, so without this a
// keyboard user tabs through the whole nav on every single page.
describe('skip to content', () => {
  it('is the first thing in the tab order and targets the content region', async () => {
    renderRoute('/');
    // A route mount lands focus on its <h1> (useFocusOnMount), which is already
    // past the nav. The skip link is for the other entry point: a fresh tab out
    // of the browser chrome, i.e. focus starting at the top of the document.
    await screen.findByRole('heading', { level: 1, name: 'nav.notes' });
    (document.activeElement as HTMLElement | null)?.blur();

    await userEvent.tab();
    const skip = screen.getByRole('link', { name: 'nav.skipToContent' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main-content');
  });

  it('points at a region that can actually take focus', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1, name: 'nav.notes' });

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    // A plain anchor target is not focusable; without this the jump is silent.
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});

describe('bottom padding', () => {
  const [CLEARANCE] = FLOATING_BOTTOM_BAR_CLEARANCE.split(' ');

  it.each([
    ['/', true],
    ['/?q=milk', true],
    ['/trash', true],
    ['/archive', false],
    ['/settings', false],
  ])('on %s clears a floating bar: %s', async (path, clears) => {
    renderRoute(path);
    await screen.findByRole('heading', { level: 1 });

    const main = document.getElementById('main-content') as HTMLElement;
    expect(main.querySelector(`.${CLEARANCE}`) !== null).toBe(clears);
  });
});

describe('collapse persistence', () => {
  it('survives a remount', async () => {
    await seedTag();
    renderRoute('/');

    // The rail's tooltips are the observable proxy for "collapsed": jsdom applies no CSS, so
    // width and `data-state` would be assertions about our own markup.
    await userEvent.hover(await within(await primaryNav()).findByRole('link', { name: 'Work' }));
    expect(screen.queryByRole('tooltip', { name: 'Work' })).not.toBeInTheDocument();

    await userEvent.click((await screen.findAllByRole('button', { name: 'nav.toggle' }))[0]);
    await waitFor(() => expect(localStorage.getItem('sidebar-open')).toBe('false'));

    cleanup();
    renderRoute('/');

    await userEvent.hover(await within(await primaryNav()).findByRole('link', { name: 'Work' }));
    expect(await screen.findByRole('tooltip', { name: 'Work' })).toBeInTheDocument();
  });
});

describe('below the nav breakpoint', () => {
  beforeEach(() => setViewportWidth(500));

  it('keeps the nav behind the trigger and closes it on navigation', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1, name: 'nav.notes' });

    // The drawer is closed, so the nav is not merely hidden - it is not rendered.
    expect(screen.queryByRole('navigation', { name: 'nav.primary' })).not.toBeInTheDocument();

    await userEvent.click((await screen.findAllByRole('button', { name: 'nav.toggle' }))[0]);
    const nav = await primaryNav();

    await userEvent.click(within(nav).getByRole('link', { name: 'nav.archive' }));

    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: 'nav.primary' })).not.toBeInTheDocument()
    );
    // Radix would restore focus to the trigger on close; `useFocusOnMount` wins.
    const heading = await screen.findByRole('heading', { level: 1, name: 'nav.archive' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('closes the drawer when the logo takes the user home', async () => {
    renderRoute('/archive');
    await screen.findByRole('heading', { level: 1, name: 'nav.archive' });

    await userEvent.click((await screen.findAllByRole('button', { name: 'nav.toggle' }))[0]);
    await primaryNav();
    await userEvent.click(screen.getByRole('link', { name: 'YourNotes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'nav.notes' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: 'nav.primary' })).not.toBeInTheDocument()
    );
  });

  // The gear goes straight to Settings on every width (CLAUDE.md, Nav shell).
  it('goes straight to the settings page from the gear', async () => {
    renderRoute('/');

    const gear = (await screen.findAllByRole('link', { name: 'nav.settings' }))[0];
    expect(gear).toHaveAttribute('href', '/settings');

    await userEvent.click(gear);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'nav.settings' })
    ).toBeInTheDocument();
    // No intermediate dialog on the way.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the nav without a trigger press at the breakpoint', async () => {
    setViewportWidth(640);
    renderRoute('/');

    expect(await primaryNav()).toBeInTheDocument();
  });
});
