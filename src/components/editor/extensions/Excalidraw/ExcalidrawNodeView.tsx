import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import DOMPurify from 'dompurify';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import { cn } from '@/lib/utils.ts';
import type { Attachment } from '@/models.ts';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { DownloadButton, useDownloadAttachment } from '../attachments/AttachmentNotDownloaded';
import { AttachmentUnavailable } from '../attachments/AttachmentUnavailable';
import type { AttachmentDeps } from '../attachments/deps';

/** A passive preview; the live canvas is the shared dialog, opened on tap. Live-queried, so
 *  when a Save repoints the node at a new row the preview follows. */
export function ExcalidrawNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const editable = props.editor?.isEditable ?? false;

  // undefined = loading, null = missing, object = ready.
  const row = useLive(
    () =>
      attachmentId
        ? {
            subscribe: (next: (row: Attachment | null) => void) =>
              deps.watchAttachment(attachmentId).subscribe((r) => next(r ?? null)),
          }
        : emptyLive<Attachment | null>(null),
    [deps.watchAttachment, attachmentId]
  );

  // A sibling of the surface, not a child, so a delete tap never opens the canvas.
  const deleteButton = editable ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.excalidraw.delete')}
      t={deps.t}
      overlay
    />
  ) : null;

  const openCanvas = () => {
    if (!attachmentId) return;
    deps.openExcalidraw({
      attachmentId,
      onDelete: () => props.deleteNode(),
      onReplace: (id) => props.updateAttributes({ attachmentId: id }),
    });
  };

  // A drawing synced from another Device shows its preview; the scene itself is
  // fetched on the first tap, and the canvas opens once it has landed.
  const { busy, download } = useDownloadAttachment(deps, attachmentId ?? '', openCanvas);
  const remote = row ? !row.blob : false;
  const openEditor = () => (remote ? void download() : openCanvas());

  if (row === null) {
    return (
      <AttachmentUnavailable
        label={deps.t('editor.excalidraw.unavailable')}
        deleteButton={deleteButton}
      />
    );
  }

  const loading = row === undefined;
  const surfaceClass = cn(
    'block max-w-full overflow-hidden rounded-md border [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full',
    loading && 'h-32 w-64 animate-pulse border-0 bg-muted'
  );
  // Self-generated SVG snapshot (see sceneToSvgString), still run through
  // DOMPurify to match the read-only NoteBody trust model.
  const previewMarkup = loading ? undefined : { __html: DOMPurify.sanitize(row.preview ?? '') };

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="relative inline-block max-w-full align-top">
        {/* Keep this button mounted while the live query resolves. Replacing the
            loading element between pointer-down and click loses the user's first
            click on fast note-open races. */}
        {editable ? (
          <button
            type="button"
            aria-label={deps.t('editor.excalidraw.edit')}
            onClick={openEditor}
            contentEditable={false}
            className={cn(surfaceClass, 'cursor-pointer text-left')}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify-sanitized SVG snapshot (see previewMarkup).
            dangerouslySetInnerHTML={previewMarkup}
          />
        ) : (
          <div
            className={surfaceClass}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify-sanitized SVG snapshot (see previewMarkup).
            dangerouslySetInnerHTML={previewMarkup}
          />
        )}
        {remote && (
          <DownloadButton
            busy={busy}
            onClick={() => void download()}
            label={deps.t('editor.attachment.download')}
            className="absolute bottom-2 left-2 bg-background/80 text-foreground backdrop-blur-sm"
          />
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ExcalidrawNodeView;
