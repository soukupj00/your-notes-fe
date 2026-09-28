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

function renderButton(service: ReturnType<typeof createHalAccountService>) {
  render(
    <AccountProvider service={service}>
      <ShareButton noteId={NOTE} ensureNoteId={async () => NOTE} className="" />
    </AccountProvider>
  );
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
    render(
      <AccountProvider service={null}>
        <ShareButton noteId={NOTE} ensureNoteId={async () => NOTE} className="" />
      </AccountProvider>
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SharesSection', () => {
  it('lists every shared Note by its header and stops one', async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByText('Trip')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'share.stop' }));
    expect(await screen.findByText('share.section.none')).toBeVisible();
    expect(server.shares).toEqual([]);
  });
});
