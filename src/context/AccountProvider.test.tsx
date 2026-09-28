import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHalAccountService } from '@/data/http/HalAccountService.ts';
import { createHalClient } from '@/data/http/hal.ts';
import { createFakeServer } from '@/test/fakeServer.ts';
import { AccountProvider, useAccount } from './AccountProvider.tsx';

function Status() {
  const { status } = useAccount();
  return <output>{status}</output>;
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
    expect(await screen.findByText('unavailable')).toBeVisible();

    server.state.offline = false;
    // Repeated until heard: the listener is attached by an effect that runs after
    // the "unavailable" render, so a single early event could land before it.
    await waitFor(() => {
      window.dispatchEvent(new Event('online'));
      expect(screen.getByText('signed-in')).toBeVisible();
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
    expect(await screen.findByText('unavailable')).toBeVisible();

    server.state.offline = false;
    await waitFor(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(screen.getByText('signed-out')).toBeVisible();
    });
  });
});
