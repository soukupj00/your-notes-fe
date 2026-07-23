import { useEffect, useRef } from 'react';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Read-only renderer for a Note's Body HTML. Sets innerHTML, then resolves every
 * <img data-attachment-id> to a Blob object URL (lazy-loaded) and revokes the
 * URLs on unmount. The one place that turns attachmentId -> object URL for the
 * non-editor path; reusable by any future read-only Note view.
 */
export function NoteBody({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { getAttachment } = useAttachmentActions();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Self-authored HTML from our own editor (same trust model as the
    // dangerouslySetInnerHTML this component replaces).
    root.innerHTML = html ?? '';
    const urls: string[] = [];
    let active = true;
    const imgs = root.querySelectorAll<HTMLImageElement>('img[data-attachment-id]');
    imgs.forEach((img) => {
      const id = img.getAttribute('data-attachment-id');
      if (!id) return;
      img.setAttribute('loading', 'lazy');
      getAttachment(id).then((att) => {
        if (!active || !att) return;
        const url = URL.createObjectURL(att.blob);
        urls.push(url);
        img.src = url;
      });
    });
    // Audio attachments have no inline representation on the card - the card
    // renders a dedicated play button (see NoteCard). Remove the src-less
    // <audio> nodes so they don't show as broken native players.
    root.querySelectorAll('audio[data-attachment-id]').forEach((el) => {
      el.remove();
    });
    return () => {
      active = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [html, getAttachment]);

  return <div ref={ref} className={cn('prose prose-sm max-w-none text-foreground', className)} />;
}

export default NoteBody;
