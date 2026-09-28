import type { AttachmentTransfer, LocalStore } from '@/data/LocalStore.ts';
import type { Remote } from '@/data/Remote.ts';

/** One blob to move: the Attachment row it belongs to, and its id on the server. */
export type Transfer = {
  id: string;
  /** The row's own id for the full bytes, its `thumbnailId` for the Preview. */
  blobId: string;
  part: 'blob' | 'thumbnail';
};

export type TransferPlan = {
  /** Rows with a thumbnail but no `thumbnailId` (written before M5 slice 5): mint one. */
  mint: string[];
  uploads: Transfer[];
  downloads: Transfer[];
};

/**
 * What a run moves (04-sync.md "Attachment transfer"), from the rows alone.
 * Uploads: bytes the server is not known to hold, of rows whose Note it knows,
 * every thumbnail before any full blob so another Device's Feed is right first.
 * Downloads: every missing thumbnail (and an image with none, which is its own);
 * every other missing full blob only when this Device keeps everything, smallest first.
 */
export function plan(
  rows: readonly AttachmentTransfer[],
  { keepEverything = false } = {}
): TransferPlan {
  const mint: string[] = [];
  const thumbnailsUp: Transfer[] = [];
  const blobsUp: Transfer[] = [];
  const thumbnailsDown: Transfer[] = [];
  const blobsDown: (Transfer & { size: number })[] = [];

  for (const { attachment: a, noteOnServer, onServer, tooLarge } of rows) {
    if (a.thumbnail && !a.thumbnailId) mint.push(a.id);
    if (noteOnServer && !tooLarge) {
      if (a.thumbnail && a.thumbnailId && !onServer.includes(a.thumbnailId)) {
        thumbnailsUp.push({ id: a.id, blobId: a.thumbnailId, part: 'thumbnail' });
      }
      if (a.blob && !onServer.includes(a.id))
        blobsUp.push({ id: a.id, blobId: a.id, part: 'blob' });
    }
    if (a.thumbnailId && !a.thumbnail) {
      thumbnailsDown.push({ id: a.id, blobId: a.thumbnailId, part: 'thumbnail' });
    }
    // An image too small to be given a thumbnail is its own Preview, so it comes with them.
    // ponytail: one whose thumbnail failed to render (an undecodable format) comes too, at full size.
    const ownPreview = a.kind === 'image' && !a.thumbnailId;
    if (!a.blob && ownPreview) {
      thumbnailsDown.push({ id: a.id, blobId: a.id, part: 'blob' });
    } else if (keepEverything && !a.blob) {
      blobsDown.push({ id: a.id, blobId: a.id, part: 'blob', size: a.size ?? Infinity });
    }
  }

  blobsDown.sort((x, y) => x.size - y.size);
  return {
    mint,
    uploads: [...thumbnailsUp, ...blobsUp],
    downloads: [...thumbnailsDown, ...blobsDown.map(({ size: _, ...t }) => t)],
  };
}

export type TransferReport = {
  /** Names of Attachments the server refused for their size in this run; each is reported once. */
  tooLarge: string[];
  /** Transfers that failed or found nothing to fetch yet; the loop runs again for them. */
  left: number;
};

/**
 * Runs `plan` against the store and the server. A transfer that fails is only
 * counted: its row is unchanged, so the next run plans it again. A 413 is
 * recorded on the row and never retried.
 */
export async function runTransfers(
  store: LocalStore,
  remote: Remote,
  { keepEverything = false } = {}
): Promise<TransferReport> {
  const rows = await store.sync.transfers();
  const byId = new Map(rows.map((row) => [row.attachment.id, row.attachment]));
  const todo = plan(rows, { keepEverything });
  const report: TransferReport = { tooLarge: [], left: 0 };

  // Owes the Note, so the next run pushes the new id and then uploads under it.
  for (const id of todo.mint) {
    await store.attachments.update(id, { thumbnailId: crypto.randomUUID() });
  }

  const refused = new Set<string>();
  for (const t of todo.uploads) {
    if (refused.has(t.id)) continue;
    const row = byId.get(t.id)!;
    try {
      if (
        (await remote.putBlob(t.blobId, (t.part === 'blob' ? row.blob : row.thumbnail)!)) ===
        'too-large'
      ) {
        refused.add(t.id);
        await store.sync.tooLarge(t.id);
        report.tooLarge.push(row.name ?? row.kind);
      } else {
        await store.sync.onServer(t.id, t.blobId);
      }
    } catch {
      report.left += 1;
    }
  }

  for (const t of todo.downloads) {
    try {
      const blob = await remote.getBlob(t.blobId);
      // Not there yet: the other Device uploads after its push, so its hint can arrive first.
      if (blob) await store.sync.received(t.id, { [t.part]: blob });
      else report.left += 1;
    } catch {
      report.left += 1;
    }
  }
  return report;
}

/**
 * One row's full bytes, on demand (a tap in its node view). Answers false when
 * the server does not have them (yet); a row that already has them is left alone.
 */
export async function downloadAttachment(
  store: LocalStore,
  remote: Remote,
  id: string
): Promise<boolean> {
  const row = await store.attachments.get(id);
  if (!row) return false;
  if (row.blob) return true;
  const blob = await remote.getBlob(id);
  if (!blob) return false;
  await store.sync.received(id, { blob });
  return true;
}
