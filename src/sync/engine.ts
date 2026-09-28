import { MAX_BATCH, type RevisionedNote } from '@/contract/index.ts';
import { type LocalStore, SYNC_META_KEYS } from '@/data/LocalStore.ts';
import type { PushBatch, PushOutcome, Remote, ServerChanges } from '@/data/Remote.ts';
import { type PushedRow, pairOutcomes } from '@/data/syncRows.ts';
import type { Note } from '@/models.ts';
import { keepConflictedCopy } from './conflictedCopy.ts';

/** What one run did that the person should hear about. */
export type SyncReport = {
  /** Conflicted Copies made; one toast says how many. */
  conflicts: number;
  /** Where they are: the Conflicts Tag, when a copy was made. */
  conflictsTagId?: string;
  /** Purges this Device made that the server refused because another Device had edited since. */
  keptNewer: number;
};

export type SyncEngine = {
  /**
   * One run: push what is owed, then pull what was missed. Runs never overlap:
   * a call during a run waits for it, and every call made during that wait
   * shares the one run that follows.
   */
  sync(): Promise<SyncReport>;
  /**
   * Attaches the store to `accountId`. The first time (or after another
   * Account), every row becomes owed and the cursor is forgotten, so the next
   * run uploads the library and pulls the Account from the start. Answers
   * whether it adopted.
   */
  adopt(accountId: string): Promise<boolean>;
};

const none: ServerChanges = { notes: [], tags: [], noteTags: [], tombstones: [] };

/**
 * The owed rows in contract order, cut into batches of at most `size` rows. The
 * order matters: the server answers `gone` for a link whose Note or Tag it does
 * not hold yet, so a link must never travel ahead of them.
 */
export function chunk(owed: PushBatch, size = MAX_BATCH): PushBatch[] {
  const ordered = [
    ...owed.notes.map((row) => ['notes', row] as const),
    ...owed.tags.map((row) => ['tags', row] as const),
    ...owed.noteTags.map((row) => ['noteTags', row] as const),
    ...owed.tombstones.map((row) => ['tombstones', row] as const),
  ];
  const batches: PushBatch[] = [];
  for (let i = 0; i < ordered.length; i += size) {
    const batch: PushBatch = { notes: [], tags: [], noteTags: [], tombstones: [] };
    for (const [key, row] of ordered.slice(i, i + size)) (batch[key] as unknown[]).push(row);
    batches.push(batch);
  }
  return batches;
}

/** The fields a person wrote, so a retried push whose answer was lost is not called a conflict. */
function sameNote(local: Note, server: RevisionedNote): boolean {
  const content = (row: object) => {
    const copy = { ...row } as Record<string, unknown>;
    delete copy.rev;
    delete copy.attachments;
    delete copy.tags;
    return JSON.stringify(copy, Object.keys(copy).sort());
  };
  return content(local) === content(server);
}

export function createSyncEngine({
  store,
  remote,
  deviceName,
  batchSize = MAX_BATCH,
  exclude = async () => new Set<string>(),
}: {
  store: LocalStore;
  remote: Remote;
  /** This Device's name, for a Conflicted Copy's header. */
  deviceName: () => string;
  /** `MAX_BATCH`; smaller in tests. */
  batchSize?: number;
  /**
   * Note ids that must never reach the server (the Tour's Props, ADR 0015):
   * left out of every push, with their links. Read at each push.
   */
  exclude?: () => Promise<ReadonlySet<string>>;
}): SyncEngine {
  const serverWins = (changes: Partial<ServerChanges>) =>
    store.sync.applyPage({ ...none, ...changes }, 'server-wins');

  /**
   * This Device's version of a Note the server is about to overwrite or remove,
   * kept as a Conflicted Copy so Sync never discards what someone wrote.
   */
  async function keepLocal(id: string, report: SyncReport, server?: RevisionedNote) {
    const local = await store.notes.get(id);
    if (!local || (server && sameNote(local, server))) return;
    report.conflictsTagId = await keepConflictedCopy(store, local, deviceName());
    report.conflicts += 1;
  }

  async function resolve(pushed: PushedRow, outcome: PushOutcome, report: SyncReport) {
    if (outcome.status === 'accepted') return;
    if (outcome.status === 'gone') {
      // Purged elsewhere while this Device edited it: the edit survives as a copy,
      // and the row goes (the server already holds its Tombstone).
      if (outcome.kind === 'note' && pushed.kind === 'note') await keepLocal(outcome.id, report);
      const deletedAt = new Date().toISOString();
      await serverWins({ tombstones: [{ id: outcome.id, kind: outcome.kind, deletedAt }] });
      return;
    }
    if (pushed.kind === 'tombstone') {
      // A stale purge: another Device edited it since, and the edit wins.
      report.keptNewer += 1;
    } else if (outcome.kind === 'note') {
      await keepLocal(outcome.id, report, outcome.server);
    }
    // A Tag conflict copies nothing: a Tag is a name, and two of the same name help nobody.
    await (outcome.kind === 'note'
      ? serverWins({ notes: [outcome.server] })
      : serverWins({ tags: [outcome.server] }));
  }

  async function owedForServer(): Promise<PushBatch> {
    const owed = await store.sync.dirty();
    const skip = await exclude();
    if (skip.size === 0) return owed;
    return {
      notes: owed.notes.filter((n) => !skip.has(n.id)),
      tags: owed.tags,
      noteTags: owed.noteTags.filter((l) => !skip.has(l.noteId)),
      tombstones: owed.tombstones.filter((t) => !skip.has(t.id)),
    };
  }

  async function push(report: SyncReport) {
    for (const batch of chunk(await owedForServer(), batchSize)) {
      const outcomes = await remote.push(batch);
      await store.sync.applied(batch, outcomes);
      for (const { pushed, outcome } of pairOutcomes(batch, outcomes)) {
        await resolve(pushed, outcome, report);
      }
    }
  }

  /** Pulls until caught up; answers whether a 410 made it start over. */
  async function pull(report: SyncReport): Promise<boolean> {
    let cursor = (await store.meta.get<string>(SYNC_META_KEYS.cursor)) ?? null;
    let resynced = false;
    for (;;) {
      const page = await remote.pull(cursor);
      if (page.status === 'cursor-too-old') {
        if (cursor === null || resynced) {
          throw new Error('The server refused a resync from the start');
        }
        // Older than the tombstone window, or ahead of a restored server: what this
        // Device holds clean can no longer be trusted, what it owes still is.
        await store.sync.resetClean();
        await store.meta.delete(SYNC_META_KEYS.cursor);
        cursor = null;
        resynced = true;
        continue;
      }
      // A Note purged elsewhere that this Device still owes an edit to is kept as a
      // copy before the Tombstone removes it.
      const purged = page.tombstones.filter((t) => t.kind === 'note');
      if (purged.length > 0) {
        const owed = new Set((await store.sync.dirty()).notes.map((n) => n.id));
        for (const t of purged) if (owed.has(t.id)) await keepLocal(t.id, report);
      }
      // ponytail: an owed row whose server version arrives here is left as it is; the
      // next push turns it into a conflict, which is the intended path (04-sync.md).
      await store.sync.applyPage(page);
      // Caught up, the cursor is the server's `resume` link: it answers what comes
      // after it, and the Device still never builds a URL.
      // TODO contract:pull - drop the `self` fallback once `resume` is vendored; it
      // only covers a server without the link (a one-page feed then stays at 0).
      cursor = page.next ?? page.resume ?? page.self;
      await store.meta.set(SYNC_META_KEYS.cursor, cursor);
      await store.meta.set(SYNC_META_KEYS.seq, page.seq);
      if (page.next === null) return resynced;
    }
  }

  async function run(): Promise<SyncReport> {
    const report: SyncReport = { conflicts: 0, keptNewer: 0 };
    await push(report);
    // A purge the server refused brings the Note back, but not its links: they
    // never changed on the server, so no later page would carry them. Reading
    // the feed again from the start does; it is rare, and applying is idempotent.
    if (report.keptNewer > 0) await store.meta.delete(SYNC_META_KEYS.cursor);
    // After a full resync the owed rows kept through it still have to go up.
    if (await pull(report)) await push(report);
    await store.meta.set(SYNC_META_KEYS.lastSyncedAt, new Date().toISOString());
    return report;
  }

  let current: Promise<SyncReport> | null = null;
  let queued: Promise<SyncReport> | null = null;

  function sync(): Promise<SyncReport> {
    if (!current) {
      current = run().finally(() => {
        current = null;
      });
      return current;
    }
    queued ??= current
      .catch(() => undefined)
      .then(() => {
        queued = null;
        return sync();
      });
    return queued;
  }

  async function adopt(accountId: string): Promise<boolean> {
    if ((await store.meta.get<string>(SYNC_META_KEYS.accountId)) === accountId) return false;
    await store.sync.adoptAll();
    await store.meta.set(SYNC_META_KEYS.accountId, accountId);
    await store.meta.delete(SYNC_META_KEYS.cursor);
    await store.meta.delete(SYNC_META_KEYS.seq);
    return true;
  }

  return { sync, adopt };
}
