import type {
  AttachmentMeta,
  RevisionedNote,
  RevisionedNoteTag,
  RevisionedTag,
} from '@/contract/index.ts';
import type { Attachment, Note } from '@/models.ts';
import type { PushBatch, PushOutcome, Tombstone } from './Remote.ts';

/**
 * Pure helpers both Local Store implementations share for sync state (M5 slice 3).
 * The state itself is store-private: no read hands `rev` or `dirty` back, so no
 * caller can carry a stale Revision into a write.
 */

/** A row as the store keeps it: the Revision it last agreed with, and whether the server is owed it. */
export type Stored<T> = T & { rev?: number; dirty?: 1 };

/** The row without its sync state, as every read returns it. */
export function strip<T extends object>(row: Stored<T>): T {
  const copy: Stored<T> = { ...row };
  delete copy.rev;
  delete copy.dirty;
  return copy;
}

/** `row` marked owed, carrying `rev` only when there is one. */
export function owed<T extends object>(row: T, rev: number | undefined): Stored<T> {
  const next: Stored<T> = { ...strip(row as Stored<T>), dirty: 1 };
  if (rev !== undefined) next.rev = rev;
  return next;
}

/** The row as it travels: its `rev`, no dirty marker. */
export function wireRow<T extends object>(row: Stored<T>): T & { rev?: number } {
  const copy: Stored<T> = { ...row };
  delete copy.dirty;
  return copy;
}

function attachmentMeta(attachment: Attachment): AttachmentMeta {
  const meta: Partial<Attachment> = { ...attachment };
  delete meta.blob;
  delete meta.thumbnail;
  return meta as AttachmentMeta;
}

/** A Note as it travels: its Attachment metadata (no bytes) on it, and no `tags` join. */
export function wireNote(note: Stored<Note>, attachments: readonly Attachment[]): RevisionedNote {
  const row = wireRow(note);
  delete row.tags;
  return { ...row, attachments: attachments.map(attachmentMeta) };
}

/** A Tombstone for a row the store just removed. The store stamps `deletedAt`: it is bookkeeping. */
export function tombstone(id: string, kind: Tombstone['kind'], rev: number | undefined): Tombstone {
  const t: Tombstone = { id, kind, deletedAt: new Date().toISOString() };
  if (rev !== undefined) t.rev = rev;
  return t;
}

/** Whether two wire rows say the same thing, `rev` aside. A false "changed" only costs a re-push. */
function sameContent(a: object, b: object): boolean {
  return JSON.stringify({ ...a, rev: undefined }) === JSON.stringify({ ...b, rev: undefined });
}

/**
 * The stored row once the server accepted `accepted`: it takes the new Revision,
 * and stops being owed only if `now` (the row as it would travel today) is still
 * what was pushed. An edit made while the push was in flight stays owed.
 */
export function settle<T extends object>(
  stored: Stored<T>,
  now: object,
  accepted: { rev: number; row: object }
): Stored<T> {
  const next: Stored<T> = { ...stored, rev: accepted.rev };
  if (sameContent(now, accepted.row)) delete next.dirty;
  return next;
}

export type AcceptedRow = { rev: number } & (
  | { kind: 'note'; row: RevisionedNote }
  | { kind: 'tag'; row: RevisionedTag }
  | { kind: 'noteTag'; row: RevisionedNoteTag }
  | { kind: 'tombstone'; row: Tombstone }
);

/**
 * The pushed rows the server accepted, each with its new Revision.
 * Outcomes come back one per row in input order (notes, tags, noteTags,
 * tombstones), so they pair by position; a count that does not match is the
 * server breaking the contract, and nothing is recorded.
 */
export function acceptedRows(batch: PushBatch, outcomes: readonly PushOutcome[]): AcceptedRow[] {
  const rows = [
    ...batch.notes.map((row) => ({ kind: 'note' as const, row })),
    ...batch.tags.map((row) => ({ kind: 'tag' as const, row })),
    ...batch.noteTags.map((row) => ({ kind: 'noteTag' as const, row })),
    ...batch.tombstones.map((row) => ({ kind: 'tombstone' as const, row })),
  ];
  if (rows.length !== outcomes.length) {
    throw new Error(`Expected ${rows.length} push outcomes, got ${outcomes.length}`);
  }
  return rows.flatMap((pushed, i) => {
    const outcome = outcomes[i]!;
    return outcome.status === 'accepted' ? [{ ...pushed, rev: outcome.rev } as AcceptedRow] : [];
  });
}
