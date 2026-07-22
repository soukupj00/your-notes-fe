import { useEffect, useRef } from 'react';
import { formatTime } from '@/components/editor/extensions/Audio/AudioNodeView';
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
    // Audio attachments render as a compact chip (mic glyph + duration), never
    // a full player, on the read-only card. No object URL is created, so there
    // is nothing to revoke on cleanup.
    const audios = root.querySelectorAll<HTMLElement>('audio[data-attachment-id]');
    audios.forEach((el) => {
      const id = el.getAttribute('data-attachment-id');
      if (!id) return;
      const chip = document.createElement('span');
      chip.className =
        'inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 align-middle text-muted-foreground text-xs';
      chip.setAttribute('data-attachment-chip', 'audio');
      el.replaceWith(chip);
      getAttachment(id).then((att) => {
        if (!active) return;
        chip.textContent =
          att?.duration != null ? `\u{1F399} ${formatTime(att.duration)}` : '\u{1F399}';
      });
    });
    return () => {
      active = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [html, getAttachment]);

  return <div ref={ref} className={cn('prose prose-sm max-w-none text-foreground', className)} />;
}

export default NoteBody;
