import { useAccount } from '@/context/AccountProvider.tsx';

export type ServerState = 'none' | 'setup-needed' | 'signed-out' | 'signed-in' | 'checking';

/** The account status, with `signed-out` split by whether the server has an Owner yet. */
export function useServerState(): ServerState {
  const { status, setupNeeded } = useAccount();

  if (status === 'unavailable') return 'none';
  if (status !== 'signed-out') return status;
  if (setupNeeded === null) return 'checking';
  return setupNeeded ? 'setup-needed' : 'signed-out';
}
