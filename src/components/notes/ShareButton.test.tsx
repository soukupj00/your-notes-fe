import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharesSection } from '@/components/settings/SharesSection.tsx';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';
import { createMemoryLocalStore } from '@/data/memory/MemoryLocalStore.ts';
import { testDraft } from '@/test/draft.ts';
import { createFakeServer } from '@/test/fakeServer.ts';
import { ShareButton } from './ShareButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
});

const AT = '2026-09-28T10:00:00.000Z';
const NOTE = '11111111-1111-4111-8111-111111111111';

async function signedIn({ onServer = true } = {}) {
  const server = createFakeServer();
  const owner = server.seedOwner('ada', 'correct horse');
  if (onServer) {
    const note = {
      id: NOTE,
      header: 'Trip',
      state: 'active',
      createdAt: AT,
      updatedAt: AT,
    } as const;
    server.sync.push(owner.id, 'seed', { notes: [note], tags: [], noteTags: [], tombstones: [] });
  }
  const service = createHalAccountService(createHalClient(server.client().fetch));
  await service.signIn('ada', 'correct horse', 'Phone');
  return { server, service };
}

/** The Note's row exists unless the test says otherwise; a new Draft is the exception. */
function renderButton(
  service: ReturnType<typeof createHalAccountService> | null,
  draft = testDraft({ id: NOTE, isNew: false })
) {
  render(
    <AccountProvider service={service}>
      <ShareButton draft={draft} className="" />
    </AccountProvider>
  );
}

/** Holds `revokeShare` until `release()`, then lets the real call through. */
function holdRevoke(service: ReturnType<typeof createHalAccountService>) {
  let release!: () => void;
  const revoke = service.revokeShare;
  const revokeShare = vi.spyOn(service, 'revokeShare').mockImplementation(async (id) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return revoke(id);
  });
  return { revokeShare, release: () => release() };
}

describe('ShareButton', () => {
  it('mints, shows and copies the link, then stops sharing', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { server, service } = await signedIn();
    renderButton(service);

    await user.click(await screen.findByRole('button', { name: 'share.action' }));
    const token = server.shares[0]!.token;
    const link = `${window.location.origin}/share/${token}`;
    expect(await screen.findByRole('dialog')).toHaveTextContent(link);
    expect(screen.getByText('share.description')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'account.qr.copy' }));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(toast.success).toHaveBeenCalledWith('account.qr.copied');

    // Closing and reopening shows the same link: a Note has one Share.
    await user.click(screen.getByRole('button', { name: 'account.qr.done' }));
    await user.click(screen.getByRole('button', { name: 'share.shared' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(link);
    expect(server.shares).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'share.stop' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(server.shares).toEqual([]);
    expect(screen.getByRole('button', { name: 'share.action' })).toBeVisible();
  });

  it('toasts a stop the server refused, keeps the link open and enables Stop again', async () => {
    const user = userEvent.setup();
    const { server, service } = await signedIn();
    renderButton(service);
    await user.click(await screen.findByRole('button', { name: 'share.action' }));
    const stop = await screen.findByRole('button', { name: 'share.stop' });

    server.state.broken = true;
    await user.click(stop);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('account.errors.unknown'));
    expect(server.shares).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(stop).not.toBeDisabled();
  });

  it('holds Stop while the server answers, so a second tap sends nothing', async () => {
    const user = userEvent.setup();
    const { server, service } = await signedIn();
    renderButton(service);
    await user.click(await screen.findByRole('button', { name: 'share.action' }));
    const stop = await screen.findByRole('button', { name: 'share.stop' });
    const { revokeShare, release } = holdRevoke(service);

    await user.click(stop);
    expect(stop).toBeDisabled();
    await user.click(stop);
    expect(revokeShare).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toast.success).toHaveBeenCalledWith('share.stopped');
    expect(server.shares).toEqual([]);
  });

  it('an already shared Note carries the mark before any tap', async () => {
    const { service } = await signedIn();
    await service.share(NOTE);
    renderButton(service);
    expect(await screen.findByRole('button', { name: 'share.shared' })).toBeVisible();
  });

  it('says so when the Note has not reached the server', async () => {
    const user = userEvent.setup();
    const { service } = await signedIn({ onServer: false });
    renderButton(service);
    await user.click(await screen.findByRole('button', { name: 'share.action' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('share.notSynced'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is absent while signed out', () => {
    renderButton(null);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Nothing can be shared before the row exists, and a read that outlasts the first `mint` would
  // turn the mark off again (PLAN.md ticket), so a new Draft is not asked about.
  it('asks the server nothing about a new Draft', async () => {
    const { service } = await signedIn();
    const shares = vi.spyOn(service, 'shares');
    renderButton(service, testDraft({ id: NOTE, isNew: true }));

    expect(await screen.findByRole('button', { name: 'share.action' })).toBeVisible();
    expect(shares).not.toHaveBeenCalled();
  });
});

async function listShares() {
  const { server, service } = await signedIn();
  await service.share(NOTE);
  const store = createMemoryLocalStore();
  await store.notes.add({
    id: NOTE,
    header: 'Trip',
    state: 'active',
    createdAt: AT,
    updatedAt: AT,
  });
  render(
    <LocalStoreProvider store={store}>
      <AccountProvider service={service}>
        <SharesSection />
      </AccountProvider>
    </LocalStoreProvider>
  );
  return { server, service };
}

describe('SharesSection', () => {
  it('lists every shared Note by its header and stops one', async () => {
    const user = userEvent.setup();
    const { server } = await listShares();

    expect(await screen.findByText('Trip')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'share.stop' }));
    expect(await screen.findByText('share.section.none')).toBeVisible();
    expect(server.shares).toEqual([]);
  });

  it('holds Stop while the server answers, so a second tap sends nothing', async () => {
    const user = userEvent.setup();
    const { server, service } = await listShares();
    const { revokeShare, release } = holdRevoke(service);
    expect(await screen.findByText('Trip')).toBeVisible();
    const stop = screen.getByRole('button', { name: 'share.stop' });

    await user.click(stop);
    expect(stop).toBeDisabled();
    await user.click(stop);
    expect(revokeShare).toHaveBeenCalledTimes(1);

    release();
    expect(await screen.findByText('share.section.none')).toBeVisible();
    expect(toast.success).toHaveBeenCalledWith('share.stopped');
    expect(server.shares).toEqual([]);
  });
});
