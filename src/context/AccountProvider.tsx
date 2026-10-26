import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AccountService, Remote, Session } from '@/data/Remote.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';

/**
 * - `checking`: the one startup question is in flight.
 * - `unavailable`: no Self-hosted Server answered (a static host, offline, or none configured).
 * - `signed-out` / `signed-in`: a server answered.
 */
export type AccountStatus = 'checking' | 'unavailable' | 'signed-out' | 'signed-in';

export type AccountContextValue = {
  status: AccountStatus;
  session: Session | null;
  /**
   * Whether the server still has no Owner, so a Sign in cannot succeed. `null` until a
   * signed-out Device has asked; a signed-in Device proves an Owner, so it is `false` there.
   */
  setupNeeded: boolean | null;
  /** `null` when this build has no server to talk to. */
  service: AccountService | null;
  /** The same server's replication half, for `SyncProvider`; `null` with no server. */
  remote: Remote | null;
  /** What a sign-in, pairing or sign-out just answered, so no second request is needed. */
  setSession: (session: Session | null) => void;
};

const NO_SERVER: AccountContextValue = {
  status: 'unavailable',
  session: null,
  setupNeeded: null,
  service: null,
  remote: null,
  setSession: () => {},
};

const AccountContext = createContext<AccountContextValue>(NO_SERVER);

/**
 * Whether this Device is signed in to a Self-hosted Server (ADR 0018). Asked once at startup and
 * never awaited: sync is opt-in, so every screen works the same whatever it hears.
 */
export function AccountProvider({
  service,
  remote = null,
  children,
}: {
  service: AccountService | null;
  remote?: Remote | null;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<AccountStatus>(service ? 'checking' : 'unavailable');
  const [session, setSessionState] = useState<Session | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  // What the server said about this Device, applied the same way whichever ask it answers.
  const apply = useCallback((found: Session | null) => {
    setSessionState(found);
    setStatus(found ? 'signed-in' : 'signed-out');
    if (found) setSetupNeeded(false);
  }, []);

  useAsyncEffect(
    async (alive) => {
      if (!service) return;
      try {
        const found = await service.session();
        if (alive()) apply(found);
      } catch {
        if (alive()) setStatus('unavailable');
      }
    },
    [service, apply]
  );

  // An app opened offline (or before the server was up) asks again when the
  // network or the page comes back, so it starts syncing without a restart.
  // Only while nothing has answered: a signed-in Device is not re-asked.
  useEffect(() => {
    if (!service || status !== 'unavailable') return;
    let current = true;
    const retry = () => {
      if (document.visibilityState === 'hidden') return;
      service
        .session()
        .then((found) => current && apply(found))
        .catch(() => {});
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      current = false;
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [service, status, apply]);

  // A failed question reads as `false`: the session check answered, so Sign in is the offer.
  useAsyncEffect(
    async (alive) => {
      if (!service || status !== 'signed-out' || setupNeeded !== null) return;
      const needed = await service.setupNeeded().catch(() => false);
      if (alive()) setSetupNeeded(needed);
    },
    [service, status, setupNeeded]
  );

  // The Owner is usually created in another tab, from the server's own Pairing Link.
  useEffect(() => {
    if (!service || status !== 'signed-out' || !setupNeeded) return;
    let current = true;
    const recheck = () => {
      if (document.visibilityState === 'hidden') return;
      service
        .setupNeeded()
        .then((needed) => current && setSetupNeeded(needed))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', recheck);
    return () => {
      current = false;
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [service, status, setupNeeded]);

  const value = useMemo<AccountContextValue>(
    () => ({ status, session, setupNeeded, service, remote, setSession: apply }),
    [status, session, setupNeeded, service, remote, apply]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/**
 * Outside a provider this answers "no server" rather than throwing: its callers
 * are Settings sections that tests mount alone, and to them no provider and no
 * server mean the same thing (as with `useTourActive`).
 */
export function useAccount(): AccountContextValue {
  return useContext(AccountContext);
}
