import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import type { AccountService, Session } from '@/data/Remote.ts';
import { createFakeServer } from '@/test/fakeServer.ts';
import { AccountProvider, useAccount } from './AccountProvider.tsx';

function Status() {
  const { status, setupNeeded } = useAccount();
  return <output>{`${status} ${setupNeeded}`}</output>;
}

const SESSION: Session = {
  accountId: 'a1',
  username: 'ada',
  role: 'owner',
  deviceId: 'd1',
  deviceName: 'Laptop',
};

function stub(session: Session | null, setupNeeded: () => Promise<boolean>) {
  return {
    session: async () => session,
    setupNeeded: vi.fn(setupNeeded),
  } as Partial<AccountService> as AccountService;
}

function renderStatus(service: AccountService) {
  render(
    <AccountProvider service={service}>
      <Status />
    </AccountProvider>
  );
}

describe('AccountProvider', () => {
  it('asks again when the network comes back, so an app opened offline can sign in', async () => {
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    const service = createHalAccountService(createHalClient(server.fetch));
    await service.signIn('ada', 'correct horse', 'Phone');
    server.state.offline = true;

    render(
      <AccountProvider service={service}>
        <Status />
      </AccountProvider>
    );
    expect(await screen.findByText(/^unavailable/)).toBeVisible();

    server.state.offline = false;
    // Repeated until heard: the listener is attached by an effect that runs after
    // the "unavailable" render, so a single early event could land before it.
    await waitFor(() => {
      window.dispatchEvent(new Event('online'));
      expect(screen.getByText(/^signed-in/)).toBeVisible();
    });
  });

  it('asks again when the page becomes visible', async () => {
    const server = createFakeServer();
    const service = createHalAccountService(createHalClient(server.fetch));
    server.state.offline = true;
    render(
      <AccountProvider service={service}>
        <Status />
      </AccountProvider>
    );
    expect(await screen.findByText(/^unavailable/)).toBeVisible();

    server.state.offline = false;
    await waitFor(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(screen.getByText(/^signed-out/)).toBeVisible();
    });
  });

  describe('whether the server still needs its Owner', () => {
    it.each([
      ['an Owner', async () => false, 'signed-out false'],
      ['no Owner yet', async () => true, 'signed-out true'],
      // The session check answered, so the server is there; Sign in is the useful offer.
      [
        'a question that fails',
        async () => {
          throw new Error('offline');
        },
        'signed-out false',
      ],
    ])('is asked once a signed-out Device hears of %s', async (_name, setupNeeded, shown) => {
      const service = stub(null, setupNeeded);
      renderStatus(service);

      expect(await screen.findByText(shown)).toBeVisible();
      expect(service.setupNeeded).toHaveBeenCalledTimes(1);
    });

    it('is never asked by a signed-in Device, which proves an Owner', async () => {
      const service = stub(SESSION, async () => true);
      renderStatus(service);

      expect(await screen.findByText('signed-in false')).toBeVisible();
      expect(service.setupNeeded).not.toHaveBeenCalled();
    });

    it('is asked again on becoming visible while no Owner exists, until one does', async () => {
      let ownerExists = false;
      const service = stub(null, async () => !ownerExists);
      renderStatus(service);
      expect(await screen.findByText('signed-out true')).toBeVisible();

      ownerExists = true;
      await waitFor(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        expect(screen.getByText('signed-out false')).toBeVisible();
      });
      const asked = vi.mocked(service.setupNeeded).mock.calls.length;

      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(service.setupNeeded).toHaveBeenCalledTimes(asked);
    });
  });
});
