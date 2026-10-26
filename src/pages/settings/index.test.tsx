import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { TourProvider } from '@/context/TourProvider.tsx';
import type { AccountService, Session } from '@/data/Remote.ts';
import { clearStore, withStore } from '@/test/store.tsx';
import SettingsHomePage from './index.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// The rows link out (`Link`) and `TourProvider` navigates (the three hooks); neither is what
// this file tests, so the router is stubbed.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ state: { location: { pathname: '/settings' } }, history: { back: vi.fn() } }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: 'http://localhost/settings' } }),
}));

afterEach(async () => {
  localStorage.clear();
  await clearStore();
});

const SESSION: Session = {
  accountId: 'a1',
  username: 'ada',
  role: 'owner',
  deviceId: 'd1',
  deviceName: 'Laptop',
};

/** Only what the Home asks: the session and, signed out, whether the server needs setting up. */
function stubService(session: Session | null): AccountService {
  return {
    session: async () => session,
    setupNeeded: async () => false,
  } as Partial<AccountService> as AccountService;
}

function tree(service: AccountService | null, home = true) {
  return withStore(
    <AccountProvider service={service}>
      <PreferencesProvider>
        <TourProvider>{home && <SettingsHomePage />}</TourProvider>
      </PreferencesProvider>
    </AccountProvider>
  );
}

function mount(service: AccountService | null = null) {
  return render(tree(service));
}

describe('the Settings home', () => {
  it('links to each group', async () => {
    mount();

    expect(await screen.findByRole('link', { name: /settings\.pages\.general/ })).toHaveAttribute(
      'href',
      '/settings/general'
    );
    expect(screen.getByRole('link', { name: /settings\.pages\.toolbar/ })).toHaveAttribute(
      'href',
      '/settings/toolbar'
    );
    expect(screen.getByRole('link', { name: /settings\.pages\.quickCapture/ })).toHaveAttribute(
      'href',
      '/settings/quick-capture'
    );
    expect(screen.getByRole('link', { name: /settings\.pages\.dataLocal/ })).toHaveAttribute(
      'href',
      '/settings/data'
    );
  });

  it('has no link back up, being the top of Settings', async () => {
    mount();

    await screen.findByRole('link', { name: /settings\.pages\.general/ });
    expect(screen.queryByRole('link', { name: 'nav.settings' })).toBeNull();
  });

  it('offers the Account page only when signed in', async () => {
    mount();
    await screen.findByRole('link', { name: /settings\.pages\.general/ });
    expect(screen.queryByRole('link', { name: /settings\.pages\.account/ })).toBeNull();
  });

  it('opens the Account page from the account card when signed in', async () => {
    mount(stubService(SESSION));

    expect(await screen.findByRole('link', { name: /ada/ })).toHaveAttribute(
      'href',
      '/settings/account'
    );
    expect(screen.queryByText('settings.home.local.title')).toBeNull();
  });

  it('says the notes stay on this device when nothing is signed in', async () => {
    mount();

    expect(await screen.findByText('settings.home.local.title')).toBeInTheDocument();
  });

  it('shows neither card while the session check is in flight', async () => {
    mount({ session: () => new Promise(() => {}) } as Partial<AccountService> as AccountService);

    await screen.findByRole('link', { name: /settings\.pages\.general/ });
    expect(screen.queryByText('settings.home.local.title')).toBeNull();
    expect(screen.queryByRole('link', { name: /ada/ })).toBeNull();
  });

  it.each([
    ['with no server', null],
    ['signed out', stubService(null)],
    ['signed in', stubService(SESSION)],
  ])('marks itself settled once the server has answered, %s', async (_name, service) => {
    const { container } = mount(service);

    await waitFor(() => expect(container.querySelector('[data-settled]')).not.toBeNull());
  });

  it('is not settled while the session check is in flight', async () => {
    const { container } = mount({
      session: () => new Promise(() => {}),
    } as Partial<AccountService> as AccountService);

    await screen.findByRole('link', { name: /settings\.pages\.general/ });
    expect(container.querySelector('[data-settled]')).toBeNull();
  });

  // Every return to the Home: a card that popped in later moved every row under the user.
  it('shows the right card on its first render once the server has answered', async () => {
    const service = stubService(null);
    const { rerender } = mount(service);
    expect(await screen.findByText('settings.home.local.title')).toBeInTheDocument();

    rerender(tree(service, false));
    rerender(tree(service));

    expect(screen.getByText('settings.home.local.title')).toBeInTheDocument();
  });

  it.each([
    ['signed in', SESSION, 'settings.pages.dataSync', 'settings.home.dataSync.summary'],
    ['not signed in', null, 'settings.pages.dataLocal', 'settings.home.dataLocal.summary'],
  ])('names the data row for a Device %s', async (_name, session, label, summary) => {
    mount(stubService(session));

    const row = await screen.findByRole('link', { name: new RegExp(label) });
    expect(row).toHaveAttribute('href', '/settings/data');
    expect(row).toHaveTextContent(summary);
  });
});

describe('the Quick capture row', () => {
  it('names the placement only below sm:, where the ＋ is', async () => {
    mount();

    const row = await screen.findByRole('link', { name: /settings\.pages\.quickCapture/ });
    expect(row.querySelector('.sm\\:hidden')).toHaveTextContent(
      'settings.home.quickCapture.summary'
    );
    expect(row.querySelector('.hidden.sm\\:inline')).toHaveTextContent(
      'settings.home.quickCapture.summaryWide'
    );
  });
});

describe('Help', () => {
  it('replays the tutorial and opens the docs, with no GitHub link', async () => {
    mount();

    expect(
      await screen.findByRole('button', { name: 'settings.help.replay.action' })
    ).toBeInTheDocument();
    const docs = screen.getByRole('link', { name: /settings\.help\.docs\.label/ });
    expect(docs).toHaveAttribute('href', 'https://soukupj00.github.io/your-notes-fe/');
    expect(docs).toHaveAccessibleName(expect.stringContaining('nav.newTab'));
    expect(screen.queryByRole('link', { name: /github/i })).toBeNull();
  });
});
