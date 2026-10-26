import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import type { AccountService, Member, Session } from '@/data/Remote.ts';
import { MembersSection } from './MembersSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const T0 = '2026-01-01T00:00:00.000Z';
const OWNER: Member = { id: 'a1', username: 'ada', role: 'owner', createdAt: T0 };
const BOB: Member = { id: 'a2', username: 'bob', role: 'member', createdAt: T0 };

const session = (role: Session['role']): Session => ({
  accountId: role === 'owner' ? OWNER.id : BOB.id,
  username: role === 'owner' ? OWNER.username : BOB.username,
  role,
  deviceId: 'd1',
  deviceName: 'Laptop',
});

function mount(role: Session['role'], accounts: () => Promise<Member[]>) {
  const service = {
    session: async () => session(role),
    accounts: vi.fn(accounts),
    createInvite: async () => ({ code: 'invite-code-1', expiresAt: T0 }),
  } as Partial<AccountService> as AccountService;
  render(
    <AccountProvider service={service}>
      <MembersSection />
    </AccountProvider>
  );
  return service;
}

describe('Members', () => {
  it('is not shown to a member, who is never sent to ask for the accounts', async () => {
    const service = mount('member', async () => [OWNER, BOB]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('account.members.title')).toBeNull();
    expect(service.accounts).not.toHaveBeenCalled();
  });

  it.each([
    ['alone on the server: Invite only', [OWNER], []],
    ['with a member: both accounts and Invite', [OWNER, BOB], ['ada', 'bob']],
  ])('shows the Owner %s', async (_name, accounts, rows) => {
    const service = mount('owner', async () => accounts);

    expect(
      await screen.findByRole('button', { name: 'account.members.invite' })
    ).toBeInTheDocument();
    await waitFor(() => expect(service.accounts).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryAllByText(/^(ada|bob)$/).map((row) => row.textContent)).toEqual(rows);
    // Reset password is the member's only: the Owner's own is reset on the server.
    expect(screen.queryAllByRole('button', { name: 'account.members.reset' })).toHaveLength(
      rows.length > 0 ? 1 : 0
    );
  });

  it('still offers Invite when the accounts cannot be read, and says so', async () => {
    const error = vi.spyOn(toast, 'error');
    mount('owner', async () => {
      throw new Error('offline');
    });

    await waitFor(() => expect(error).toHaveBeenCalledWith('account.errors.unknown'));
    expect(screen.getByRole('button', { name: 'account.members.invite' })).toBeInTheDocument();
  });

  it('opens an Invite as a Pairing Link', async () => {
    mount('owner', async () => [OWNER]);

    await userEvent.click(await screen.findByRole('button', { name: 'account.members.invite' }));

    expect(await screen.findByText(/\/pair#invite-code-1$/)).toBeVisible();
  });
});
