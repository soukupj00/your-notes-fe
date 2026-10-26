import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import type { AccountService, Session } from '@/data/Remote.ts';
import { type ServerState, useServerState } from './useServerState.ts';

const SESSION: Session = {
  accountId: 'a1',
  username: 'ada',
  role: 'owner',
  deviceId: 'd1',
  deviceName: 'Laptop',
};

const never = () => new Promise<never>(() => {});

function stub(session: () => Promise<Session | null>, setupNeeded: () => Promise<boolean>) {
  return { session, setupNeeded: vi.fn(setupNeeded) } as Partial<AccountService> as AccountService;
}

const CASES: [name: string, service: AccountService | null, expected: ServerState][] = [
  ['no server', null, 'none'],
  [
    'a server with no Owner',
    stub(
      async () => null,
      async () => true
    ),
    'setup-needed',
  ],
  [
    'an Owner, nobody signed in',
    stub(
      async () => null,
      async () => false
    ),
    'signed-out',
  ],
  [
    'a setup question that fails',
    stub(
      async () => null,
      async () => {
        throw new Error('offline');
      }
    ),
    'signed-out',
  ],
  ['a session', stub(async () => SESSION, never), 'signed-in'],
  ['a session check in flight', stub(never, never), 'checking'],
];

describe('useServerState', () => {
  it.each(CASES)('reads %s', async (_name, service, expected) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AccountProvider service={service}>{children}</AccountProvider>
    );
    const { result } = renderHook(() => useServerState(), { wrapper });

    await waitFor(() => expect(result.current).toBe(expected));
  });

  it('never asks a signed-in Device whether the server needs setting up', async () => {
    const service = stub(
      async () => SESSION,
      async () => true
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AccountProvider service={service}>{children}</AccountProvider>
    );
    const { result } = renderHook(() => useServerState(), { wrapper });

    await waitFor(() => expect(result.current).toBe('signed-in'));
    expect(service.setupNeeded).not.toHaveBeenCalled();
  });

  it('reports checking until the setup question answers, not a guess', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AccountProvider service={stub(async () => null, never)}>{children}</AccountProvider>
    );
    const { result } = renderHook(() => useServerState(), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBe('checking');
  });
});
