import type { z } from 'zod';
import { type ChangesPage, noteTagId, type PushResponse } from '@/contract/index.ts';
import type { PushBatch, PushOutcome, Tombstone } from '@/data/Remote.ts';

type Kind = 'note' | 'tag' | 'noteTag';
type Incoming =
  | { kind: Kind; rev?: number | undefined }
  | { kind: 'tombstone'; of: Kind; rev?: number | undefined };
type Decision =
  | { status: 'accepted'; rev: number; write: 'row' | 'tombstone' | 'nothing' }
  | { status: 'conflict' }
  | { status: 'gone' };

/**
 * The backend's sync rules, copied from `ni-dip-be/src/sync/decide.ts` as the
 * spec this fake answers by (backend PLAN.md "Sync rules"). Keep it a copy, not
 * a re-derivation: if the two disagree, the backend is right and this changes.
 */
export function decide(
  incoming: Incoming,
  existing: { rev: number } | undefined,
  tombstoned: boolean
): Decision {
  const next = (existing?.rev ?? 0) + 1;
  if (incoming.kind === 'tombstone') {
    if (tombstoned) return { status: 'accepted', rev: next, write: 'nothing' };
    if (incoming.of !== 'noteTag' && existing && incoming.rev !== existing.rev) {
      return { status: 'conflict' };
    }
    return { status: 'accepted', rev: next, write: 'tombstone' };
  }
  if (tombstoned) return { status: 'gone' };
  if (incoming.kind === 'noteTag') return { status: 'accepted', rev: next, write: 'row' };
  if (!existing) return { status: 'accepted', rev: 1, write: 'row' };
  if (incoming.rev === existing.rev) return { status: 'accepted', rev: next, write: 'row' };
  return { status: 'conflict' };
}

type Stored = { kind: Kind; row: Record<string, unknown>; rev: number; seq: number };
type Book = {
  seq: number;
  /** The backend's `prunedSeq`: a cursor below it may have missed a swept Tombstone. */
  floor: number;
  rows: Map<string, Stored>;
  tombstones: Map<string, { tomb: Tombstone; seq: number }>;
};

const idOf = (kind: Kind, row: Record<string, unknown>) =>
  kind === 'noteTag' ? noteTagId(String(row.noteId), String(row.tagId)) : String(row.id);
const withoutRev = (row: object) => {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.rev;
  return copy;
};

/**
 * One server's rows per Account, with a Revision and a Sequence each, the way
 * the backend keeps them (rows are the feed; no change log). `pageSize` is the
 * backend's `PAGE_SIZE`, small in tests so paging is exercised.
 */
export function createFakeSync() {
  const books = new Map<string, Book>();
  const listeners = new Set<{
    accountId: string;
    deviceId: string;
    onHint: (seq: number) => void;
  }>();
  const settings = { pageSize: 50 };

  const book = (accountId: string) => {
    let found = books.get(accountId);
    if (!found) {
      found = { seq: 0, floor: 0, rows: new Map(), tombstones: new Map() };
      books.set(accountId, found);
    }
    return found;
  };

  function push(
    accountId: string,
    deviceId: string,
    batch: PushBatch
  ): z.input<typeof PushResponse> {
    const b = book(accountId);
    const tombstoned = (kind: Kind, row: Record<string, unknown>) => {
      if (kind !== 'noteTag') return b.tombstones.has(String(row.id));
      const noteId = String(row.noteId);
      const tagId = String(row.tagId);
      return (
        b.tombstones.has(noteId) ||
        b.tombstones.has(tagId) ||
        !b.rows.has(`note:${noteId}`) ||
        !b.rows.has(`tag:${tagId}`)
      );
    };
    const outcome = (kind: Kind, id: string, row: Record<string, unknown>, rev?: number) => {
      const key = `${kind}:${id}`;
      const existing = b.rows.get(key);
      const d = decide({ kind, rev }, existing, tombstoned(kind, row));
      if (d.status === 'accepted') {
        b.rows.set(key, { kind, row: withoutRev(row), rev: d.rev, seq: ++b.seq });
        return { kind, id, status: 'accepted' as const, rev: d.rev };
      }
      if (d.status === 'gone') return { kind, id, status: 'gone' as const };
      return conflict(kind, id, existing!);
    };
    const conflict = (kind: Kind, id: string, existing: Stored) =>
      ({
        kind,
        id,
        status: 'conflict',
        server: { ...existing.row, rev: existing.rev },
      }) as PushOutcome;

    const outcomes: PushOutcome[] = [
      ...batch.notes.map((n) => outcome('note', n.id, n, n.rev)),
      ...batch.tags.map((t) => outcome('tag', t.id, t, t.rev)),
      ...batch.noteTags.map((l) => outcome('noteTag', idOf('noteTag', l), l, l.rev)),
      ...batch.tombstones.map((t): PushOutcome => {
        const key = `${t.kind}:${t.id}`;
        const existing = b.rows.get(key);
        const d = decide(
          { kind: 'tombstone', of: t.kind, rev: t.rev },
          existing,
          b.tombstones.has(t.id)
        );
        if (d.status === 'conflict') return conflict(t.kind, t.id, existing!);
        if (d.status !== 'accepted') return { kind: t.kind, id: t.id, status: 'gone' };
        if (d.write === 'tombstone') {
          b.rows.delete(key);
          // The server removes a Note's or Tag's links with it (backend `changes.ts`).
          for (const [k, stored] of b.rows) {
            if (
              stored.kind === 'noteTag' &&
              (stored.row.noteId === t.id || stored.row.tagId === t.id)
            ) {
              b.rows.delete(k);
            }
          }
          b.tombstones.set(t.id, {
            tomb: { id: t.id, kind: t.kind, deletedAt: t.deletedAt },
            seq: ++b.seq,
          });
        }
        return { kind: t.kind, id: t.id, status: 'accepted', rev: d.rev };
      }),
    ];
    if (outcomes.some((o) => o.status === 'accepted')) {
      for (const l of listeners) {
        if (l.accountId === accountId && l.deviceId !== deviceId) l.onHint(b.seq);
      }
    }
    return {
      outcomes,
      seq: b.seq,
      _links: { self: { href: '/api/changes' }, changes: { href: '/api/changes' } },
    };
  }

  /**
   * A page after `since`, or `null` for a 410. `from` is where the pull began
   * (backend feat/feed-resume-link): every `next` carries it, and the floor is
   * checked against it, so a pull that began at 0 can page past swept Tombstones.
   */
  function pull(
    accountId: string,
    since: number,
    from?: number
  ): z.input<typeof ChangesPage> | null {
    const b = book(accountId);
    const origin = from ?? since;
    if (since > b.seq || (origin > 0 && origin < b.floor)) return null;
    const entries = [
      ...[...b.rows.values()].map((s) => ({ seq: s.seq, row: s })),
      ...[...b.tombstones.values()].map((t) => ({ seq: t.seq, tomb: t.tomb })),
    ]
      .filter((e) => e.seq > since)
      .sort((x, y) => x.seq - y.seq);
    const page = entries.slice(0, settings.pageSize);
    const rowsOf = (kind: Kind) =>
      page.flatMap((e) =>
        'row' in e && e.row.kind === kind ? [{ ...e.row.row, rev: e.row.rev }] : []
      );
    const last = page[page.length - 1];
    const more = entries.length > page.length && last !== undefined;
    const nextHref = `/api/changes?since=${last?.seq}&from=${origin}`;
    return {
      notes: rowsOf('note'),
      tags: rowsOf('tag'),
      noteTags: rowsOf('noteTag'),
      tombstones: page.flatMap((e) => ('tomb' in e ? [e.tomb] : [])),
      seq: b.seq,
      _links: {
        self: { href: `/api/changes?since=${since}` },
        stream: { href: '/api/changes/stream' },
        ...(more ? { next: { href: nextHref } } : {}),
        // Equal to `next` on a full page, else the Account's Sequence, without `from`.
        resume: { href: more ? nextHref : `/api/changes?since=${b.seq}` },
      },
    } as z.input<typeof ChangesPage>;
  }

  return {
    settings,
    push,
    pull,
    /** Live Update for one Device: every accepted push by another Device of the Account. */
    subscribe(accountId: string, deviceId: string, onHint: (seq: number) => void) {
      const listener = { accountId, deviceId, onHint };
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The row the server holds, without its Revision, or undefined. */
    row(accountId: string, kind: Kind, id: string) {
      return book(accountId).rows.get(`${kind}:${id}`);
    },
    /**
     * Every Tombstone so far is swept, as the backend's daily sweep does after
     * 90 days: a cursor from before the newest of them answers 410.
     */
    sweepTombstones(accountId: string) {
      const b = book(accountId);
      for (const { seq } of b.tombstones.values()) b.floor = Math.max(b.floor, seq);
      b.tombstones.clear();
    },
  };
}
