import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider, useAccount } from '@/context/AccountProvider.tsx';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import PairPage from './pair.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => navigate,
}));

afterEach(() => {
  navigate.mockClear();
  window.history.replaceState(null, '', '/');
});

/** Shows who the page signed in, as the rest of the app would see it. */
function Who() {
  const { session } = useAccount();
  return <output>{session ? `${session.username}:${session.role}` : 'nobody'}</output>;
}

function open(server: FakeServer, code: string) {
  window.history.replaceState(null, '', `/pair#${code}`);
  render(
    <AccountProvider service={createHalAccountService(createHalClient(server.fetch))}>
      <PairPage />
      <Who />
    </AccountProvider>
  );
}

async function fill(label: string, value: string) {
  const input = await screen.findByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe('/pair', () => {
  it('the printed setup link creates the Owner and goes to the Notes', async () => {
    const server = createFakeServer();
    open(server, 'setup-code');

    expect(await screen.findByRole('heading', { name: 'account.pair.ownerTitle' })).toBeVisible();
    await fill('account.username', 'ada');
    await fill('account.password', 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: 'account.pair.ownerAction' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(screen.getByRole('status')).toHaveTextContent('ada:owner');
    expect(server.accounts).toMatchObject([{ username: 'ada', role: 'owner' }]);
  });

  it('a device link asks only for the Device name, suggested from the platform', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada');
    open(server, server.mintCode('device', owner.id));

    expect(await screen.findByRole('heading', { name: 'account.pair.deviceTitle' })).toBeVisible();
    expect(screen.queryByLabelText('account.password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('account.deviceName.label')).not.toHaveValue('');
    await fill('account.deviceName.label', 'Kitchen tablet');
    await userEvent.click(screen.getByRole('button', { name: 'account.pair.deviceAction' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(server.devices.map((d) => d.name)).toContain('Kitchen tablet');
  });

  it('an Invite lands on the Invite form without the person choosing it', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada');
    open(server, server.mintCode('invite', owner.id));

    await userEvent.click(await screen.findByRole('button', { name: 'account.pair.deviceAction' }));
    expect(await screen.findByRole('heading', { name: 'account.pair.inviteTitle' })).toBeVisible();

    await fill('account.username', 'ada');
    await fill('account.password', 'password1');
    await userEvent.click(screen.getByRole('button', { name: 'account.pair.inviteAction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('account.errors.usernameTaken');

    await fill('account.username', 'cleo');
    await userEvent.click(screen.getByRole('button', { name: 'account.pair.inviteAction' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cleo:member'));
  });

  it('a spent link says so', async () => {
    const server = createFakeServer();
    server.seedOwner('ada');
    open(server, 'setup-code');

    await userEvent.click(await screen.findByRole('button', { name: 'account.pair.deviceAction' }));
    await fill('account.username', 'eve');
    await fill('account.password', 'password1');
    await userEvent.click(await screen.findByRole('button', { name: 'account.pair.inviteAction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('account.errors.linkUsed');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a link with no code says so and offers the Notes', async () => {
    const server = createFakeServer();
    open(server, '');
    expect(await screen.findByRole('alert')).toHaveTextContent('account.pair.missingCode');
  });

  it('no server answering is not a crash', async () => {
    const server = createFakeServer();
    server.state.staticHost = true;
    open(server, 'setup-code');
    expect(await screen.findByRole('alert')).toHaveTextContent('account.errors.unreachable');
  });
});
