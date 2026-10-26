import { render, screen } from '@testing-library/react';
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

function mount(service: AccountService | null = null) {
  return render(
    withStore(
      <AccountProvider service={service}>
        <PreferencesProvider>
          <TourProvider>
            <SettingsHomePage />
          </TourProvider>
        </PreferencesProvider>
      </AccountProvider>
    )
  );
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

  it('offers the Account page only when signed in', async () => {
    mount();
    await screen.findByRole('link', { name: /settings\.pages\.general/ });
    expect(screen.queryByRole('link', { name: /settings\.pages\.account/ })).toBeNull();
  });

  it('links to the Account page when signed in', async () => {
    mount(stubService(SESSION));

    expect(await screen.findByRole('link', { name: /settings\.pages\.account/ })).toHaveAttribute(
      'href',
      '/settings/account'
    );
  });
});
