import { NodeViewWrapper } from '@tiptap/react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { formatBytes } from '@/lib/format-attachment.ts';
import { cn } from '@/lib/utils.ts';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';

/**
 * A download tap for an Attachment known through Sync whose bytes are not on
 * this Device (04-sync.md "Attachment transfer"). Writes the bytes into the
 * row; the node view reads it live, so it turns into the real thing by itself.
 * `onDone` runs after a download that landed (Excalidraw opens its canvas).
 */
export function useDownloadAttachment(deps: AttachmentDeps, id: string, onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await deps.downloadAttachment(id)) onDone?.();
      else toast(deps.t('editor.attachment.notOnServer'));
    } catch {
      toast(deps.t('editor.attachment.downloadFailed'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, download };
}

/** The download button itself: neutral, never the accent (DESIGN.md One Accent Rule), 44px to a finger. */
export function DownloadButton({
  busy,
  onClick,
  label,
  className,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const Download = icons.Download;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-busy={busy}
      contentEditable={false}
      className={cn(
        'touch-target flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-60',
        className
      )}
    >
      {busy ? <Spinner /> : <Download className="size-4" />}
    </button>
  );
}

/**
 * What an image, audio, video or file node draws while its bytes are still on
 * the server: an image's or video's Preview when there is one, with the
 * download button over it; otherwise a card with the name, the size and the button.
 */
export function AttachmentNotDownloaded({
  attachment,
  thumbnailUrl,
  deps,
  fallbackName,
  deleteButton,
}: {
  attachment: Attachment;
  thumbnailUrl?: string;
  deps: AttachmentDeps;
  fallbackName: string;
  deleteButton: ReactNode;
}) {
  const { busy, download } = useDownloadAttachment(deps, attachment.id);
  const label = deps.t('editor.attachment.download');
  const name = attachment.name ?? fallbackName;

  // A picture's Preview stands in for it at the size the real thing will take,
  // when the row knows it (M5 slice 5), so nothing jumps when the bytes land.
  if (thumbnailUrl && (attachment.kind === 'image' || attachment.kind === 'video')) {
    return (
      <NodeViewWrapper
        as="div"
        className="not-prose relative my-2 inline-block max-w-full"
        data-drag-handle
      >
        <img
          src={thumbnailUrl}
          alt={name}
          width={attachment.width}
          height={attachment.height}
          className="block h-auto max-w-full rounded-md"
        />
        <DownloadButton
          busy={busy}
          onClick={() => void download()}
          label={label}
          className="absolute bottom-2 left-2 bg-background/80 text-foreground backdrop-blur-sm"
        />
        {deleteButton}
      </NodeViewWrapper>
    );
  }

  const Icon = icons.FileText;
  const size = formatBytes(attachment.size);
  return (
    <NodeViewWrapper as="div" className="relative my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 py-2 pr-12 pl-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{name}</span>
          <span className="block text-muted-foreground text-xs">
            {size ? `${size} · ` : ''}
            {deps.t('editor.attachment.notDownloaded')}
          </span>
        </span>
        <DownloadButton busy={busy} onClick={() => void download()} label={label} />
      </div>
      {deleteButton}
    </NodeViewWrapper>
  );
}
