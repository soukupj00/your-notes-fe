import type {
  AttachmentMeta,
  RevisionedNote,
  RevisionedNoteTag,
  RevisionedTag,
} from '@/contract/index.ts';
import type { Attachment, Note } from '@/models.ts';
import type { AttachmentTransfer } from './LocalStore.ts';
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

/**
 * An Attachment as the store keeps it (M5 slice 5): `onServer` lists the blob ids
 * (its own, its `thumbnailId`) the server is known to hold, and `tooLarge` marks
 * bytes the server refused for their size. A list of ids rather than flags, so a
 * new `thumbnailId` is not uploaded by construction.
 */
export type StoredAttachment = Attachment & { onServer?: string[]; tooLarge?: 1 };

/** The row without its transfer state, as every read returns it. */
export function stripAttachment(row: StoredAttachment): Attachment {
  const copy: StoredAttachment = { ...row };
  delete copy.onServer;
  delete copy.tooLarge;
  return copy;
}

function attachmentMeta(attachment: StoredAttachment): AttachmentMeta {
  const meta: Partial<StoredAttachment> = stripAttachment(attachment);
  delete meta.blob;
  delete meta.thumbnail;
  return meta as AttachmentMeta;
}

/**
 * A pulled Attachment as the store keeps it: the server's metadata, with the
 * bytes and transfer state this Device already had for the id. A thumbnail is
 * kept only while `thumbnailId` still names it.
 */
export function fromServerAttachment(
  meta: AttachmentMeta,
  local: StoredAttachment | undefined
): StoredAttachment {
  const row: StoredAttachment = { ...meta };
  if (!local) return row;
  if (local.blob) row.blob = local.blob;
  if (local.thumbnail && local.thumbnailId === meta.thumbnailId) row.thumbnail = local.thumbnail;
  if (local.onServer) row.onServer = local.onServer;
  if (local.tooLarge) row.tooLarge = local.tooLarge;
  return row;
}

/**
 * What writing a pulled Note's `attachments` does to the rows it owns locally:
 * each listed one is put (keeping bytes, see `fromServerAttachment`), each
 * unlisted one is removed with its bytes.
 */
export function reconcileAttachments(
  metas: readonly AttachmentMeta[],
  local: readonly StoredAttachment[]
): { put: StoredAttachment[]; remove: string[] } {
  const byId = new Map(local.map((row) => [row.id, row]));
  const listed = new Set(metas.map((meta) => meta.id));
  return {
    put: metas.map((meta) => fromServerAttachment(meta, byId.get(meta.id))),
    remove: local.filter((row) => !listed.has(row.id)).map((row) => row.id),
  };
}

/** The row as `sync.transfers()` hands it out. */
export function transferOf(row: StoredAttachment, noteOnServer: boolean): AttachmentTransfer {
  return {
    attachment: stripAttachment(row),
    noteOnServer,
    onServer: row.onServer ?? [],
    tooLarge: row.tooLarge === 1,
  };
}

/** The row once the server is known to hold `blobIds`. */
export function markOnServer(row: StoredAttachment, ...blobIds: string[]): StoredAttachment {
  return { ...row, onServer: [...new Set([...(row.onServer ?? []), ...blobIds])] };
}

/** The row with downloaded bytes written in, each marked as held by the server. */
export function withReceived(
  row: StoredAttachment,
  { blob, thumbnail }: { blob?: Blob; thumbnail?: Blob }
): StoredAttachment {
  const next = { ...row };
  const ids: string[] = [];
  if (blob) {
    next.blob = blob;
    ids.push(row.id);
  }
  if (thumbnail && row.thumbnailId) {
    next.thumbnail = thumbnail;
    ids.push(row.thumbnailId);
  }
  return markOnServer(next, ...ids);
}

/** A Note as it travels: its Attachment metadata (no bytes) on it, and no `tags` join. */
export function wireNote(
  note: Stored<Note>,
  attachments: readonly StoredAttachment[]
): RevisionedNote {
  const row = wireRow(note);
  delete row.tags;
  return { ...row, attachments: attachments.map(attachmentMeta) };
}

/**
 * A Note as the server sent it, as the store keeps it: the server's Revision,
 * not owed, and without its Attachment metadata (the store writes those as rows).
 */
export function fromServerNote(row: RevisionedNote): Stored<Note> {
  const note: RevisionedNote = { ...row };
  delete note.attachments;
  return note;
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

export type PushedRow =
  | { kind: 'note'; row: RevisionedNote }
  | { kind: 'tag'; row: RevisionedTag }
  | { kind: 'noteTag'; row: RevisionedNoteTag }
  | { kind: 'tombstone'; row: Tombstone };

/**
 * Each pushed row with the outcome the server gave it. Outcomes come back one
 * per row in input order (notes, tags, noteTags, tombstones), so they pair by
 * position; a count that does not match is the server breaking the contract.
 */
export function pairOutcomes(
  batch: PushBatch,
  outcomes: readonly PushOutcome[]
): { pushed: PushedRow; outcome: PushOutcome }[] {
  const rows: PushedRow[] = [
    ...batch.notes.map((row) => ({ kind: 'note' as const, row })),
    ...batch.tags.map((row) => ({ kind: 'tag' as const, row })),
    ...batch.noteTags.map((row) => ({ kind: 'noteTag' as const, row })),
    ...batch.tombstones.map((row) => ({ kind: 'tombstone' as const, row })),
  ];
  if (rows.length !== outcomes.length) {
    throw new Error(`Expected ${rows.length} push outcomes, got ${outcomes.length}`);
  }
  return rows.map((pushed, i) => ({ pushed, outcome: outcomes[i]! }));
}

/** The pushed rows the server accepted, each with its new Revision; nothing is recorded if they do not pair. */
export function acceptedRows(batch: PushBatch, outcomes: readonly PushOutcome[]): AcceptedRow[] {
  return pairOutcomes(batch, outcomes).flatMap(({ pushed, outcome }) =>
    outcome.status === 'accepted' ? [{ ...pushed, rev: outcome.rev } as AcceptedRow] : []
  );
}
