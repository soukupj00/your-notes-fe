import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { AccountSection } from './AccountSection.tsx';
import { DevicesSection } from './DevicesSection.tsx';
import { MembersSection } from './MembersSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
  }),
}));

function mount(server: FakeServer) {
  const service = createHalAccountService(createHalClient(server.fetch));
  render(
    <AccountProvider service={service}>
      <AccountSection />
      <DevicesSection />
      <MembersSection />
    </AccountProvider>
  );
  return service;
}

async function signIn(username: string, password: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'account.section.signIn' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('account.username'), username);
  await userEvent.type(within(dialog).getByLabelText('account.password'), password);
  await userEvent.click(within(dialog).getByRole('button', { name: 'account.section.signIn' }));
}

describe('Settings account sections', () => {
  it('render nothing when no server answers', async () => {
    const server = createFakeServer();
    server.state.staticHost = true;
    const { container } = render(
      <AccountProvider service={createHalAccountService(createHalClient(server.fetch))}>
        <AccountSection />
        <DevicesSection />
        <MembersSection />
      </AccountProvider>
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('signs in, saying so when the password is wrong, then signs out', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    mount(server);

    await signIn('ada', 'wrong password');
    expect(await screen.findByRole('alert')).toHaveTextContent('account.errors.wrongCredentials');
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('account.password'));
    await userEvent.type(within(dialog).getByLabelText('account.password'), 'correct horse');
    await userEvent.click(within(dialog).getByRole('button', { name: 'account.section.signIn' }));

    expect(await screen.findByText('account.section.signedInLabel ada')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'account.section.signOut' }));
    expect(await screen.findByText('account.section.signedOutLabel')).toBeVisible();
    expect(screen.queryByText('account.devices.title')).not.toBeInTheDocument();
  });

  it('lists Devices, removes another one after confirming, and shows a Pairing Link', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    mount(server);
    await signIn('ada', 'correct horse');

    expect(await screen.findByText('Laptop')).toBeVisible();
    expect(screen.getByText('account.devices.current')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'account.devices.remove' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'account.devices.remove',
      })
    );
    await waitFor(() => expect(screen.queryByText('Laptop')).not.toBeInTheDocument());
    expect(server.devices).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'account.devices.add' }));
    const qr = await screen.findByRole('img', { name: 'account.devices.add' });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(screen.getByText(`${window.location.origin}/pair#device-code-1`)).toBeVisible();
  });

  it('only the Owner sees Members, and its Invite is a Pairing Link', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    server.seedMember('bob', 'battery staple');
    mount(server);

    await signIn('bob', 'battery staple');
    expect(await screen.findByText('account.section.signedInLabel bob')).toBeVisible();
    expect(screen.queryByText('account.members.title')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'account.section.signOut' }));

    await signIn('ada', 'correct horse');
    await userEvent.click(await screen.findByRole('button', { name: 'account.members.invite' }));
    expect(await screen.findByText(/\/pair#invite-code-\d+$/)).toBeVisible();
  });

  it("lists every Account for the Owner and resets a member's password", async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    const bob = server.seedMember('bob', 'battery staple');
    mount(server);
    await signIn('ada', 'correct horse');

    expect(await screen.findByText('bob')).toBeVisible();
    expect(screen.getByText('account.section.owner · account.members.you')).toBeVisible();
    // One reset button: the member's, never the Owner's own row.
    await userEvent.click(screen.getByRole('button', { name: 'account.members.reset' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('account.members.resetTitle bob')).toBeVisible();
    await userEvent.type(
      within(dialog).getByLabelText('account.members.newPassword'),
      'a new secret'
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'account.members.save' }));

    await waitFor(() => expect(bob.password).toBe('a new secret'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
