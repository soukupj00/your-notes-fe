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
    let url: string | null = null;
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    getAttachment(attachmentId).then((att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      url = URL.createObjectURL(att.blob);
      setState({ status: 'ready', url, name: att.name, attachment: att });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId, getAttachment]);
  return state;
}
