import { sanitizeBodyToNodes } from '@/components/NoteBody.tsx';
import type { AttachmentMeta, SharedNote } from '@/contract/index.ts';
import { sharedBlobUrl } from '@/data/http/publicShare.ts';
import { isGenericName } from '@/lib/attachments.ts';
import { ATTACHMENT_ID_ATTR } from '@/lib/body.ts';
import { sanitizeDrawingPreviewToNodes } from '@/lib/drawing-preview.ts';

const MEDIA = 'block h-auto max-w-full rounded-md';

export interface SharedBodyLabels {
  fileFallbackName: string;
  drawingFallbackName: string;
  /** The element saying "opens in a new tab", which every link that does is described by. */
  newTabHintId: string;
}

/**
 * A stranger's Body, sanitized once into nodes that are never parsed again, with each attachment
 * rebuilt from the Note's own list (docs/architecture/05-server.md, "Security posture").
 */
export function sharedBodyNodes(shared: SharedNote, labels: SharedBodyLabels): Node[] {
  const body = sanitizeBodyToNodes(shared.note.body ?? '');
  const doc = body.ownerDocument;
  const listed = new Map((shared.note.attachments ?? []).map((a) => [a.id, a]));

  for (const node of body.querySelectorAll(`[${ATTACHMENT_ID_ATTR}]`)) {
    const meta = listed.get(node.getAttribute(ATTACHMENT_ID_ATTR) ?? '');
    if (meta) node.replaceWith(attachmentElement(doc, shared, meta, labels));
    else node.remove();
  }
  // After the attachments, so a link inside a Drawing's preview is caught too.
  for (const a of body.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    if (!a.hasAttribute('download')) a.setAttribute('aria-describedby', labels.newTabHintId);
  }
  // Checklists are shown, not ticked: the page writes nothing anywhere.
  for (const input of body.querySelectorAll('input')) input.setAttribute('disabled', '');
  return [...body.childNodes];
}

function attachmentElement(
  doc: Document,
  shared: SharedNote,
  meta: AttachmentMeta,
  labels: SharedBodyLabels
): Element {
  const src = sharedBlobUrl(shared, meta.id);
  const sized = (el: HTMLElement) => {
    if (meta.width) el.setAttribute('width', String(meta.width));
    if (meta.height) el.setAttribute('height', String(meta.height));
    return el;
  };
  switch (meta.kind) {
    case 'image': {
      const img = sized(doc.createElement('img'));
      img.setAttribute('src', src);
      img.setAttribute('alt', meta.name ?? '');
      img.setAttribute('loading', 'lazy');
      img.className = MEDIA;
      return img;
    }
    case 'video': {
      const video = sized(doc.createElement('video'));
      video.setAttribute('src', src);
      video.setAttribute('controls', '');
      video.setAttribute('preload', 'metadata');
      if (meta.thumbnailId) video.setAttribute('poster', sharedBlobUrl(shared, meta.thumbnailId));
      video.className = MEDIA;
      return video;
    }
    case 'audio': {
      const audio = doc.createElement('audio');
      audio.setAttribute('src', src);
      audio.setAttribute('controls', '');
      audio.setAttribute('preload', 'metadata');
      audio.className = 'my-2 w-full';
      return audio;
    }
    case 'excalidraw': {
      // The sanitizer `ExcalidrawNodeView` uses on the stored preview SVG, as nodes.
      const drawing = doc.createElement('div');
      drawing.append(sanitizeDrawingPreviewToNodes(meta.preview ?? ''));
      drawing.setAttribute('role', 'img');
      drawing.setAttribute('aria-label', drawingName(meta, labels.drawingFallbackName));
      drawing.className =
        'my-2 block max-w-full overflow-hidden rounded-md border [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full';
      return drawing;
    }
    case 'file': {
      const a = doc.createElement('a');
      a.setAttribute('href', src);
      a.setAttribute('download', meta.name ?? '');
      a.textContent = meta.name ?? labels.fileFallbackName;
      a.className = 'my-2 block truncate rounded-md border bg-muted/40 px-3 py-2 text-sm';
      return a;
    }
  }
}

function drawingName(meta: AttachmentMeta, fallback: string): string {
  return meta.name && !isGenericName('excalidraw', meta.name) ? meta.name : fallback;
}
