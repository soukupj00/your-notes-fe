import { ProblemError } from '@/data/http/hal.ts';
import { type LocalStore, SYNC_META_KEYS } from '@/data/LocalStore.ts';
import type { Remote } from '@/data/Remote.ts';
import type { SyncEngine, SyncReport } from './engine.ts';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncLoop = {
  /** Runs now (or joins the run in flight); resolves when it is over, whatever happened. */
  syncNow(): Promise<void>;
  /** Stops every trigger; resolves once a run in flight has finished writing. */
  stop(): Promise<void>;
};

/**
 * When to sync (04-sync.md "The loop"): at start, on a hint past the last pull, after a local edit,
 * on `online`, on becoming visible, and on a slow poll. A `401` stops it and calls `onSignedOut`.
 */
export function startSyncLoop({
  engine,
  remote,
  store,
  onStatus,
  onReport,
  onSignedOut,
  pollMs = 5 * 60_000,
  editDelayMs = 2_000,
  target = window,
  doc = document,
}: {
  engine: SyncEngine;
  remote: Remote;
  store: LocalStore;
  onStatus: (status: SyncStatus) => void;
  onReport: (report: SyncReport) => void;
  /** The server no longer knows this Device's Session (removed, or an older backup restored). */
  onSignedOut?: () => void;
  pollMs?: number;
  /** How long a burst of typing settles before its edits are pushed. */
  editDelayMs?: number;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}): SyncLoop {
  let stopped = false;
  let running = 0;
  let inflight: Promise<unknown> = Promise.resolve();
  let followUp: ReturnType<typeof setTimeout> | undefined;
  /** Doubles while runs keep leaving work owed (a failing server), so they never spin. */
  let backoff = editDelayMs;

  const later = (ms: number) => {
    clearTimeout(followUp);
    if (!stopped) followUp = setTimeout(() => void syncNow(), ms);
  };

  async function syncNow() {
    if (stopped) return;
    if (!navigator.onLine) {
      onStatus('offline');
      return;
    }
    running += 1;
    onStatus('syncing');
    let status: SyncStatus = 'idle';
    let transfersLeft = 0;
    try {
      const run = engine.sync();
      inflight = run;
      const report = await run;
      transfersLeft = report.transfersLeft;
      onReport(report);
    } catch (error) {
      if (error instanceof ProblemError && error.status === 401) {
        // Retrying cannot help, only signing in again can.
        // A run queued behind this one answers 401 too, and must not say so again.
        if (!stopped) {
          stopped = true;
          onSignedOut?.();
        }
        return;
      }
      // `fetch` rejects with a TypeError when nothing answered at all.
      status = error instanceof TypeError ? 'offline' : 'error';
    } finally {
      running -= 1;
    }
    if (stopped || running > 0) return;
    onStatus(status);
    const owed = await new Promise<number>((resolve) => {
      const unsubscribe = store.sync.pending().subscribe((n) => {
        queueMicrotask(() => unsubscribe());
        resolve(n);
      });
    });
    // Bytes left to move count as owed: a thumbnail the other Device has not uploaded yet
    // is fetched on the back-off instead of at the next poll.
    if ((owed > 0 || transfersLeft > 0) && status !== 'offline') {
      later(backoff);
      backoff = Math.min(backoff * 2, pollMs);
    } else {
      backoff = editDelayMs;
    }
  }

  // A local edit: debounced, and ignored while a run is in flight (its own
  // writes deliver here too; what it leaves owed is picked up after it).
  const unsubscribePending = store.sync.pending().subscribe((n) => {
    if (n > 0 && running === 0) later(editDelayMs);
  });

  const unsubscribeHints = remote.hints?.((seq) => {
    void store.meta.get<number>(SYNC_META_KEYS.seq).then((known) => {
      if (seq > (known ?? -1)) void syncNow();
    });
  });

  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (doc.visibilityState === 'visible') void syncNow();
  };
  target.addEventListener('online', onOnline);
  doc.addEventListener('visibilitychange', onVisible);
  const poll = setInterval(() => void syncNow(), pollMs);
  void syncNow();

  return {
    syncNow,
    async stop() {
      stopped = true;
      clearTimeout(followUp);
      clearInterval(poll);
      unsubscribePending();
      unsubscribeHints?.();
      target.removeEventListener('online', onOnline);
      doc.removeEventListener('visibilitychange', onVisible);
      await inflight.catch(() => undefined);
    },
  };
}
