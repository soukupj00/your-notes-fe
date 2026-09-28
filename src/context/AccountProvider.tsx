import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { AccountService, Remote, Session } from '@/data/Remote.ts';

/**
 * - `checking`: the one startup question is in flight.
 * - `unavailable`: no Self-hosted Server answered (a static host, offline, or none configured).
 * - `signed-out` / `signed-in`: a server answered.
 */
export type AccountStatus = 'checking' | 'unavailable' | 'signed-out' | 'signed-in';

export type AccountContextValue = {
  status: AccountStatus;
  session: Session | null;
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
  service: null,
  remote: null,
  setSession: () => {},
};

const AccountContext = createContext<AccountContextValue>(NO_SERVER);

/**
 * Whether this Device is signed in to a Self-hosted Server (ADR 0018). It asks
 * once at startup and never blocks anything: sync is opt-in, so every screen
 * works the same whatever it hears, and only the Account sections of Settings
 * and `/pair` read it.
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

  useEffect(() => {
    if (!service) return;
    let current = true;
    service
      .session()
      .then((found) => {
        if (!current) return;
        setSessionState(found);
        setStatus(found ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (current) setStatus('unavailable');
      });
    return () => {
      current = false;
    };
  }, [service]);

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
        .then((found) => {
          if (!current) return;
          setSessionState(found);
          setStatus(found ? 'signed-in' : 'signed-out');
        })
        .catch(() => {});
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      current = false;
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [service, status]);

  const value = useMemo<AccountContextValue>(
    () => ({
      status,
      session,
      service,
      remote,
      setSession: (next) => {
        setSessionState(next);
        setStatus(next ? 'signed-in' : 'signed-out');
      },
    }),
    [status, session, service, remote]
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
