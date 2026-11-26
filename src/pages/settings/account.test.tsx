import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import type { AccountService, Session } from '@/data/Remote.ts';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import AccountSettingsPage from './account.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

afterEach(clearStore);

const SESSION: Session = {
  accountId: 'a1',
  username: 'ada',
  role: 'owner',
  deviceId: 'd1',
  deviceName: 'Laptop',
};

function signedIn(): AccountService {
  return {
    session: async () => SESSION,
    signOut: vi.fn(async () => {}),
    devices: async () => [
      { id: 'd1', name: 'Laptop', lastSeenAt: '2026-01-01T00:00:00.000Z', current: true },
    ],
    shares: async () => [],
    accounts: async () => [
      { id: 'a1', username: 'ada', role: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
  } as Partial<AccountService> as AccountService;
}

function mount(service: AccountService | null) {
  return render(
    withStore(
      <AccountProvider service={service}>
        <AccountSettingsPage />
      </AccountProvider>
    )
  );
}

describe('the Account page', () => {
  it.each([
    ['no server answers', null],
    [
      'nobody is signed in',
      {
        session: async () => null,
        setupNeeded: async () => false,
      } as Partial<AccountService> as AccountService,
    ],
  ])('sends the user back to Settings when %s', async (_name, service) => {
    mount(service);

    expect(await screen.findByText('redirected to /settings')).toBeInTheDocument();
  });

  it('waits for the session check instead of redirecting', async () => {
    mount({ session: () => new Promise(() => {}) } as Partial<AccountService> as AccountService);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/redirected/)).toBeNull();
  });

  it('shows the account card, Devices, Shared notes and Members, in that order', async () => {
    mount(signedIn());

    expect(await screen.findByText('ada')).toBeInTheDocument();
    expect(screen.getByText('account.section.owner')).toBeInTheDocument();
    await screen.findByText('account.members.title');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'account.devices.title',
      'share.section.title',
      'account.members.title',
    ]);
    expect(screen.getByText('share.section.none')).toBeInTheDocument();
  });

  it("names each row's button after its row, so no two read the same", async () => {
    const T0 = '2026-01-01T00:00:00.000Z';
    for (const [id, header] of [
      ['n1', 'Groceries'],
      ['n2', 'Trip plan'],
    ]) {
      await testStore.notes.add({ id, header, state: 'active', createdAt: T0, updatedAt: T0 });
    }
    const service = signedIn();
    mount({
      ...service,
      devices: async () => [
        ...(await service.devices()),
        { id: 'd2', name: 'Phone', lastSeenAt: T0, current: false },
        { id: 'd3', name: 'Tablet', lastSeenAt: T0, current: false },
      ],
      shares: async () => [
        { id: 's1', noteId: 'n1', token: 't1', createdAt: T0 },
        { id: 's2', noteId: 'n2', token: 't2', createdAt: T0 },
      ],
      accounts: async () => [
        ...(await service.accounts()),
        { id: 'a2', username: 'bob', role: 'member', createdAt: T0 },
        { id: 'a3', username: 'cy', role: 'member', createdAt: T0 },
      ],
    } as AccountService);

    for (const row of ['Tablet', 'Trip plan', 'cy']) await screen.findByText(row);
    for (const name of [
      'account.devices.removeNamed Phone',
      'account.devices.removeNamed Tablet',
      'share.stopNamed Groceries',
      'share.stopNamed Trip plan',
      'account.members.resetNamed bob',
      'account.members.resetNamed cy',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  // Each was a row whose button repeated its label; on a phone the button dropped under it.
  it.each(['account.devices.add', 'account.members.invite'])(
    'offers %s as a row of its own, not a row with a button',
    async (label) => {
      mount(signedIn());

      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
      expect(screen.getAllByText(label)).toHaveLength(1);
    }
  );

  it('sends the user back to Settings once they sign out here', async () => {
    mount(signedIn());

    await userEvent.click(await screen.findByRole('button', { name: 'account.section.signOut' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'account.section.eraseConfirm',
      })
    );

    await waitFor(() => expect(screen.getByText('redirected to /settings')).toBeInTheDocument());
  });
});
