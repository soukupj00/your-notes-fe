import DOMPurify from 'dompurify';
import { sanitizeBody } from '@/components/NoteBody.tsx';
import type { AttachmentMeta, SharedNote } from '@/contract/index.ts';
import { sharedBlobUrl } from '@/data/http/publicShare.ts';
import { ATTACHMENT_ID_ATTR } from '@/lib/body.ts';

const MEDIA = 'block h-auto max-w-full rounded-md';

/**
 * A shared Note's Body as markup for the read-only Share Link page. The Body is
 * untrusted server data here, so it goes through the app's own sanitizer first
 * (`sanitizeBody`), and every attachment node is then *replaced* by an element
 * built from the Note's own `attachments` list: its bytes come only from the
 * page's `_links.blobs` template, and a node the Note does not list is dropped.
 * The work happens in an inert `DOMParser` document, so nothing loads before
 * React mounts the result.
 */
export function sharedBodyMarkup(shared: SharedNote, fileFallbackName: string): string {
  const doc = new DOMParser().parseFromString(sanitizeBody(shared.note.body ?? ''), 'text/html');
  const listed = new Map((shared.note.attachments ?? []).map((a) => [a.id, a]));

  for (const node of doc.body.querySelectorAll(`[${ATTACHMENT_ID_ATTR}]`)) {
    const meta = listed.get(node.getAttribute(ATTACHMENT_ID_ATTR) ?? '');
    if (meta) node.replaceWith(attachmentElement(doc, shared, meta, fileFallbackName));
    else node.remove();
  }
  for (const a of doc.body.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  // Checklists are shown, not ticked: the page writes nothing anywhere.
  for (const input of doc.body.querySelectorAll('input')) input.setAttribute('disabled', '');
  return doc.body.innerHTML;
}

function attachmentElement(
  doc: Document,
  shared: SharedNote,
  meta: AttachmentMeta,
  fileFallbackName: string
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
      // The same call `ExcalidrawNodeView` makes on the stored preview SVG.
      const drawing = doc.createElement('div');
      drawing.innerHTML = DOMPurify.sanitize(meta.preview ?? '');
      drawing.className =
        'my-2 block max-w-full overflow-hidden rounded-md border [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full';
      return drawing;
    }
    case 'file': {
      const a = doc.createElement('a');
      a.setAttribute('href', src);
      a.setAttribute('download', meta.name ?? '');
      a.textContent = meta.name ?? fileFallbackName;
      a.className = 'my-2 block truncate rounded-md border bg-muted/40 px-3 py-2 text-sm';
      return a;
    }
  }
}
