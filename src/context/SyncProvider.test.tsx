import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncSection } from '@/components/settings/SyncSection.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalRemote } from '@/data/http/HalRemote.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import { createSyncEngine } from '@/sync/engine.ts';
import { createFakeServer } from '@/test/fakeServer.ts';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import { AccountProvider } from './AccountProvider.tsx';
import { SyncProvider } from './SyncProvider.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

afterEach(async () => {
  await clearStore();
  vi.clearAllMocks();
});

const T0 = '2026-01-01T00:00:00.000Z';

/** This Device, rendered: signed in, with the real HAL adapters over the fake server. */
async function mountSignedIn() {
  const server = createFakeServer();
  const owner = server.seedOwner('ada', 'correct horse');
  const client = server.client();
  const hal = createHalClient(client.fetch);
  const service = createHalAccountService(hal);
  await service.signIn('ada', 'correct horse', 'Phone');
  render(
    withStore(
      <AccountProvider service={service} remote={createHalRemote(hal)}>
        <PreferencesProvider>
          <SyncProvider>
            <SyncSection />
          </SyncProvider>
        </PreferencesProvider>
      </AccountProvider>
    )
  );
  return { server, owner };
}

/**
 * Presses "Sync now" once it can be pressed: it is disabled while a run is in
 * flight (the startup run, or one a local edit scheduled), and a click on a
 * disabled button is silently dropped.
 */
async function pressSyncNow() {
  const button = await screen.findByRole('button', { name: 'sync.syncNow' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

/** Another of the Owner's Devices, driven directly through its engine. */
async function otherDevice(server: ReturnType<typeof createFakeServer>, accountId: string) {
  const hal = createHalClient(server.client().fetch);
  await createHalAccountService(hal).signIn('ada', 'correct horse', 'Laptop');
  const store = createMemoryLocalStore();
  const engine = createSyncEngine({
    store,
    remote: createHalRemote(hal),
    deviceName: () => 'Laptop',
  });
  await engine.adopt(accountId);
  return { store, engine };
}

describe('SyncProvider', () => {
  it('syncs once signed in and shows the last sync and what still waits', async () => {
    const { server, owner } = await mountSignedIn();
    expect(await screen.findByText(/^sync\.syncedAt /)).toBeVisible();

    const id = crypto.randomUUID();
    await testStore.notes.add({ id, state: 'active', createdAt: T0, updatedAt: T0 });
    expect(await screen.findByText(/sync\.pending 1/)).toBeVisible();
    await pressSyncNow();
    await waitFor(() => expect(server.sync.row(owner.id, 'note', id)).toBeDefined());
    await waitFor(() => expect(screen.queryByText(/sync\.pending/)).not.toBeInTheDocument());
  });

  it('signs this Device out when the server forgets its Session, and keeps what it owes', async () => {
    const { server } = await mountSignedIn();
    expect(await screen.findByText(/^sync\.syncedAt /)).toBeVisible();
    server.devices.splice(
      server.devices.findIndex((d) => d.name === 'Phone'),
      1
    );
    const id = crypto.randomUUID();
    await testStore.notes.add({ id, state: 'active', createdAt: T0, updatedAt: T0 });

    // No press: some run always follows (the startup run, or the Note's own debounced
    // one), and its 401 can unmount the sync row before a press would land.
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'sync.signedOut',
        expect.objectContaining({
          id: 'sync-signed-out',
          duration: Number.POSITIVE_INFINITY,
          action: expect.objectContaining({ label: 'account.section.signIn' }),
        })
      )
    );
    expect(screen.queryByText('sync.label')).not.toBeInTheDocument();
    expect(await testStore.notes.get(id)).toBeDefined();
    expect((await testStore.sync.dirty()).notes.map((n) => n.id)).toContain(id);
  });

  it('one toast per run that kept Conflicted Copies', async () => {
    const { server, owner } = await mountSignedIn();
    const laptop = await otherDevice(server, owner.id);
    const id = crypto.randomUUID();
    await laptop.store.notes.add({
      id,
      header: 'Plan',
      state: 'active',
      createdAt: T0,
      updatedAt: T0,
    });
    await laptop.engine.sync();
    await pressSyncNow();
    await waitFor(async () => expect(await testStore.notes.get(id)).toBeDefined());

    await laptop.store.notes.update(id, () => ({ header: 'Laptop wins', updatedAt: T0 }));
    await laptop.engine.sync();
    await testStore.notes.update(id, () => ({ header: 'Phone loses' }));
    await pressSyncNow();

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast).mock.calls[0]?.[0]).toBe('sync.conflicts 1');
    expect((await testStore.notes.get(id))?.header).toBe('Laptop wins');
  });

  it('shows no sync row, and does nothing, while signed out', async () => {
    render(
      withStore(
        <AccountProvider service={null}>
          <PreferencesProvider>
            <SyncProvider>
              <SyncSection />
            </SyncProvider>
          </PreferencesProvider>
        </AccountProvider>
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('sync.label')).not.toBeInTheDocument();
  });
});
