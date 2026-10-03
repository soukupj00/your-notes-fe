import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { SyncProvider } from '@/context/SyncProvider.tsx';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createFakeServer, type FakeServer } from '@/test/fakeServer.ts';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import { AccountSection } from './AccountSection.tsx';
import { DevicesSection } from './DevicesSection.tsx';
import { MembersSection } from './MembersSection.tsx';

const language = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { language: language.current },
  }),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const exportBackup = vi.hoisted(() => vi.fn());
vi.mock('@/lib/export-backup.ts', () => ({ exportBackup }));

afterEach(async () => {
  language.current = 'en';
  await clearStore();
});

const T0 = '2026-01-01T00:00:00.000Z';

/** No `remote`: the sync loop stays off, but what the store owes still counts. */
function mount(server: FakeServer) {
  const service = createHalAccountService(createHalClient(server.fetch));
  render(
    withStore(
      <AccountProvider service={service}>
        <PreferencesProvider>
          <SyncProvider>
            <AccountSection />
            <DevicesSection />
            <MembersSection />
          </SyncProvider>
        </PreferencesProvider>
      </AccountProvider>
    )
  );
  return service;
}

async function signOut() {
  await userEvent.click(screen.getByRole('button', { name: 'account.section.signOut' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'account.section.eraseConfirm' })
  );
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
    await signOut();
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

  // An English and a Czech medium date: against browser-locale code one row fails on any runner.
  it.each([
    ['en', /^account\.devices\.lastSeen [A-Z][a-z]{2} \d{1,2}, \d{4}/],
    ['cs', /^account\.devices\.lastSeen \d{1,2}\. \d{1,2}\. \d{4}/],
  ])(
    "writes the last-seen date in the app language (%s), not the browser's",
    async (lang, shape) => {
      language.current = lang;
      const server = createFakeServer();
      server.seedOwner('ada', 'correct horse');
      mount(server);
      await signIn('ada', 'correct horse');

      await screen.findByText('Laptop');

      expect(screen.getByText(shape)).toBeInTheDocument();
    }
  );

  it('only the Owner sees Members, and its Invite is a Pairing Link', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    server.seedMember('bob', 'battery staple');
    mount(server);

    await signIn('bob', 'battery staple');
    expect(await screen.findByText('account.section.signedInLabel bob')).toBeVisible();
    expect(screen.queryByText('account.members.title')).not.toBeInTheDocument();
    await signOut();

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

  it('signing out erases this Device', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    const id = crypto.randomUUID();
    // A Note the server already has: on this Device, and owed to nobody.
    await testStore.sync.applyPage({
      notes: [{ id, state: 'active', createdAt: T0, updatedAt: T0, rev: 1, attachments: [] }],
      tags: [],
      noteTags: [],
      tombstones: [],
    });
    mount(server);
    await signIn('ada', 'correct horse');

    await signOut();
    expect(await screen.findByText('account.section.signedOutLabel')).toBeVisible();
    expect(await testStore.notes.list()).toEqual([]);
  });

  it('refuses to sign out while a change is still owed, offering a way out', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    await testStore.notes.add({
      id: crypto.randomUUID(),
      state: 'active',
      createdAt: T0,
      updatedAt: T0,
    });
    mount(server);
    await signIn('ada', 'correct horse');

    await userEvent.click(await screen.findByRole('button', { name: 'account.section.signOut' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('account.section.blockedTitle')).toBeVisible();
    expect(within(dialog).getByText('account.section.blockedDescription 1')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'account.section.saveBackup' })
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'sync.syncNow' })).toBeVisible();
    expect(await testStore.notes.list()).toHaveLength(1);
    // Still signed in: the seeded Laptop and this Device.
    expect(server.devices).toHaveLength(2);
  });

  it('saves a backup from the blocked dialog through the one export flow', async () => {
    exportBackup.mockResolvedValue('saved');
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    await testStore.notes.add({
      id: crypto.randomUUID(),
      state: 'active',
      createdAt: T0,
      updatedAt: T0,
    });
    mount(server);
    await signIn('ada', 'correct horse');
    await userEvent.click(await screen.findByRole('button', { name: 'account.section.signOut' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'account.section.saveBackup' })
    );

    await waitFor(() => expect(exportBackup).toHaveBeenCalledTimes(1));
    expect(exportBackup).toHaveBeenCalledWith(testStore);
  });
});
