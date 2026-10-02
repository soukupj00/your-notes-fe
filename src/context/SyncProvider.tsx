import { useNavigate } from '@tanstack/react-router';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SYNC_META_KEYS } from '@/data/LocalStore.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';
import { readProps } from '@/lib/tour/props.ts';
import { downloadAttachment } from '@/sync/attachments.ts';
import { createSyncEngine, type SyncReport } from '@/sync/engine.ts';
import { type SyncLoop, type SyncStatus, startSyncLoop } from '@/sync/loop.ts';
import { useAccount } from './AccountProvider.tsx';
import { usePreferences } from './PreferencesProvider.tsx';
import { useTourActive } from './TourProvider.tsx';

export type SyncContextValue = {
  /** Whether a signed-in session is syncing at all; everything else is idle without one. */
  active: boolean;
  status: SyncStatus;
  /** ISO time of the last completed run, from `meta`, so it survives a reload. */
  lastSyncedAt: string | null;
  /** Rows and Tombstones the server is owed (the Offline Mutation Queue), live. */
  pending: number;
  syncNow(): Promise<void>;
  /** Stops syncing and waits for a run in flight: the step before erasing this Device. */
  stop(): Promise<void>;
  /**
   * Fetches one Attachment's full bytes (a tap in its node view). Answers false
   * when the server does not have them yet; rejects when signed out or unreachable.
   */
  download(id: string): Promise<boolean>;
};

const INACTIVE: SyncContextValue = {
  active: false,
  status: 'idle',
  lastSyncedAt: null,
  pending: 0,
  syncNow: async () => {},
  stop: async () => {},
  download: async () => {
    throw new Error('Not signed in to a server');
  },
};

const SyncContext = createContext<SyncContextValue>(INACTIVE);

// One id, so a second sign-out replaces the toast and a sign-in can take it away.
const SIGNED_OUT_TOAST = 'sync-signed-out';

/**
 * Runs the sync loop (`src/sync/loop.ts`) while this Device is signed in, and
 * says how it is going. Mounted in `routes/__root.tsx`, inside the router,
 * because two of its toasts link into the app (to the Conflicts Tag and to
 * Settings). It never blocks a screen: signed out or with no server, it is
 * inactive and every value is at rest.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useLocalStore();
  const { session, remote, setSession } = useAccount();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const pending = useLive(() => store.sync.pending(), [store]) ?? 0;
  const loopRef = useRef<SyncLoop | null>(null);

  const accountId = session?.accountId;
  const deviceName = session?.deviceName ?? '';
  const active = Boolean(accountId && remote);
  // The Tour's Props are disposable (ADR 0015): nothing syncs while it runs, and
  // the engine leaves any left behind (a reload mid-Tour) out of every push.
  const touring = useTourActive();
  // Read by the engine at each run, so turning it on needs no restart of the loop.
  const keepEverything = usePreferences().preferences.keepEverything;
  const keepEverythingRef = useRef(keepEverything);
  useEffect(() => {
    keepEverythingRef.current = keepEverything;
    if (keepEverything) void loopRef.current?.syncNow();
  }, [keepEverything]);

  // Kept in a ref so the loop's lifetime depends only on the session, the server,
  // the store and the Tour: a new `t` (a language change) must not restart syncing.
  const onReportRef = useRef<(report: SyncReport) => void>(() => {});
  const onReport = (report: SyncReport) => {
    void store.meta.get<string>(SYNC_META_KEYS.lastSyncedAt).then((at) => {
      setLastSyncedAt(at ?? null);
    });
    if (report.conflicts > 0 && report.conflictsTagId) {
      const id = report.conflictsTagId;
      toast(t('sync.conflicts', { count: report.conflicts }), {
        action: {
          label: t('sync.showConflicts'),
          onClick: () => void navigate({ to: '/tag/$id', params: { id } }),
        },
      });
    }
    if (report.keptNewer > 0) toast.info(t('sync.keptNewer'));
    for (const name of report.tooLarge) toast.error(t('sync.tooLarge', { name }));
  };
  const onSignedOutRef = useRef<() => void>(() => {});
  const onSignedOut = () => {
    setSession(null);
    // Stays until dismissed: it is the only notice that this Device stopped syncing.
    toast(t('sync.signedOut'), {
      id: SIGNED_OUT_TOAST,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: t('account.section.signIn'),
        onClick: () => void navigate({ to: '/settings' }),
      },
      cancel: {
        label: t('account.section.close'),
        onClick: () => undefined,
      },
    });
  };
  useEffect(() => {
    onReportRef.current = onReport;
    onSignedOutRef.current = onSignedOut;
  });
  useEffect(() => {
    if (accountId) toast.dismiss(SIGNED_OUT_TOAST);
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !remote || touring) return;
    let cancelled = false;
    const engine = createSyncEngine({
      store,
      remote,
      deviceName: () => deviceName,
      exclude: async () => new Set((await readProps(store)).map((prop) => prop.id)),
      keepEverything: () => keepEverythingRef.current,
    });
    void store.meta.get<string>(SYNC_META_KEYS.lastSyncedAt).then((at) => {
      if (!cancelled) setLastSyncedAt(at ?? null);
    });
    // Adopt first: on a first sign-in it owes the whole library, which the loop's
    // first run then uploads.
    void engine.adopt(accountId).then(() => {
      if (cancelled) return;
      loopRef.current = startSyncLoop({
        engine,
        remote,
        store,
        onStatus: setStatus,
        onReport: (report) => onReportRef.current(report),
        onSignedOut: () => onSignedOutRef.current(),
      });
    });
    return () => {
      cancelled = true;
      void loopRef.current?.stop();
      loopRef.current = null;
      setStatus('idle');
    };
  }, [accountId, deviceName, remote, store, touring]);

  const value = useMemo<SyncContextValue>(
    () =>
      active
        ? {
            active,
            status,
            lastSyncedAt,
            pending,
            syncNow: () => loopRef.current?.syncNow() ?? Promise.resolve(),
            stop: async () => {
              const loop = loopRef.current;
              loopRef.current = null;
              await loop?.stop();
            },
            download: (id: string) => downloadAttachment(store, remote!, id),
          }
        : { ...INACTIVE, pending },
    [active, status, lastSyncedAt, pending, store, remote]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** Outside a provider this answers "not syncing", like `useAccount()`: Settings tests mount sections alone. */
export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
