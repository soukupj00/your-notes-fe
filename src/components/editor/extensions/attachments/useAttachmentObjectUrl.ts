import { useEffect, useState } from 'react';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';

export type AttachmentUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; name?: string; attachment: Attachment }
  | { status: 'missing' };

/**
 * Resolves attachmentId -> Blob -> object URL for a React NodeView, revoking the
 * URL on unmount / id change (ADR 0007 lifecycle). Extracted from Slice 1's
 * ImageNodeView so image + audio (+ future media) share one implementation.
 * Pass a STABLE getAttachment (the useAttachmentActions one is a stable
 * useCallback) so the effect does not re-run every render.
 */
export function useAttachmentObjectUrl(
  attachmentId: string | null,
  getAttachment: AttachmentDeps['getAttachment']
): AttachmentUrlState {
  const [state, setState] = useState<AttachmentUrlState>({ status: 'loading' });

  useEffect(() => {
    if (!attachmentId) return;
    let url: string | null = null;
    let active = true;

    getAttachment(attachmentId)
      .then((att) => {
        if (!active) return;
        if (!att) {
          setState({ status: 'missing' });
          return;
        }
        url = URL.createObjectURL(att.blob);
        setState({ status: 'ready', url, name: att.name, attachment: att });
      })
      // An unreadable row must resolve to 'missing'. Left floating, a rejection
      // was unhandled *and* pinned the node view on 'loading' forever.
      .catch(() => {
        if (active) setState({ status: 'missing' });
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId, getAttachment]);

  // A node carrying no attachment id has nothing to resolve. That is a fact
  // about this render, so derive it rather than round-tripping through an
  // effect - the setState version cost an extra render on every such node.
  if (!attachmentId) return { status: 'missing' };
  return state;
}
