import { useState } from 'react';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';

export type ServerState = 'none' | 'setup-needed' | 'signed-out' | 'signed-in' | 'checking';

/**
 * The account status, with `signed-out` split by whether the server has an Owner yet: without
 * one a Sign in cannot succeed. A failed setup question still means the server answered.
 */
export function useServerState(): ServerState {
  const { status, service } = useAccount();
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useAsyncEffect(
    async (alive) => {
      if (status !== 'signed-out' || !service) return;
      const needed = await service.setupNeeded().catch(() => false);
      if (alive()) setSetupNeeded(needed);
    },
    [status, service]
  );

  if (status === 'unavailable') return 'none';
  if (status !== 'signed-out') return status;
  if (setupNeeded === null) return 'checking';
  return setupNeeded ? 'setup-needed' : 'signed-out';
}
