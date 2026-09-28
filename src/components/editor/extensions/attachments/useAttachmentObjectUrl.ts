import { useEffect, useMemo } from 'react';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';

export type AttachmentUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; name?: string; attachment: Attachment }
  /** Known through Sync but its bytes are not on this Device; `thumbnailUrl` when its Preview is. */
  | { status: 'remote'; attachment: Attachment; thumbnailUrl?: string }
  | { status: 'missing' };

const NO_ROW = emptyLive<Attachment | null>(null);

/**
 * Resolves attachmentId -> Blob -> object URL for a React NodeView, revoking the
 * URL on unmount / id change (ADR 0007 lifecycle). Shared by image, audio,
 * video and file. The row is read live (M5 slice 5), so a download or a pull
 * turns a `remote` row `ready` without reopening the Note. Pass a STABLE
 * `watchAttachment` (the useAttachmentActions one is) so it is not
 * re-subscribed every render.
 */
export function useAttachmentObjectUrl(
  attachmentId: string | null,
  watchAttachment: AttachmentDeps['watchAttachment']
): AttachmentUrlState {
  // undefined = loading, null = no such row.
  const row = useLive(
    () =>
      attachmentId
        ? {
            subscribe: (next: (row: Attachment | null) => void) =>
              watchAttachment(attachmentId).subscribe((r) => next(r ?? null)),
          }
        : NO_ROW,
    [attachmentId, watchAttachment]
  );

  // Minted during render and revoked by the effect's cleanup, as CardMedia does:
  // an effect that set state would paint one empty frame first.
  const bytes = row ? (row.blob ?? row.thumbnail) : undefined;
  const url = useMemo(() => (bytes ? URL.createObjectURL(bytes) : undefined), [bytes]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  // A node carrying no attachment id has nothing to resolve.
  if (!attachmentId || row === null) return { status: 'missing' };
  if (row === undefined) return { status: 'loading' };
  if (!row.blob) return { status: 'remote', attachment: row, thumbnailUrl: url };
  return { status: 'ready', url: url!, name: row.name, attachment: row };
}
