import type { AttachmentKind } from '@/models.ts';

/**
 * The Body is the authority on order and kind, because the card (`CardMedia`) needs both before
 * the rows resolve, even for a deleted row. The row only supplies bytes.
 */
export interface BodyAttachment {
  id: string;
  kind: AttachmentKind;
}

/** The five serialized forms our editor emits, mapped to the stored kind. */
const KIND_BY_TAG: Record<string, AttachmentKind> = {
  img: 'image',
  video: 'video',
  audio: 'audio',
  a: 'file',
  'excalidraw-drawing': 'excalidraw',
};

// Same trust model as `attachment-html.ts`. Its own `g` const, because `matchAll` needs the flag
// and `.test()` callers must not inherit its stateful `lastIndex`.
const ATTACHMENT_NODE_RE =
  /<(img|video|audio|a|excalidraw-drawing)\b[^>]*\bdata-attachment-id="([^"]+)"/gi;

// Void and paired forms strip differently: an <img> is the whole node, while the
// other four wrap content that has to go with them. Our attachment nodes are
// always leaves, so a non-greedy match to the first matching close tag is safe.
const VOID_ATTACHMENT_RE = /<img\b[^>]*\bdata-attachment-id="[^"]+"[^>]*>/gi;
const PAIRED_ATTACHMENT_RE =
  /<(video|audio|a|excalidraw-drawing)\b[^>]*\bdata-attachment-id="[^"]+"[^>]*>[\s\S]*?<\/\1>/gi;

/** Skips an unknown tag, so a future node type shows "no preview" rather than the wrong one. */
export function extractBodyAttachments(html: string | null | undefined): BodyAttachment[] {
  if (!html) return [];
  const seen = new Set<string>();
  const found: BodyAttachment[] = [];
  for (const match of html.matchAll(ATTACHMENT_NODE_RE)) {
    const kind = KIND_BY_TAG[match[1].toLowerCase()];
    if (!kind || seen.has(match[2])) continue;
    seen.add(match[2]);
    found.push({ id: match[2], kind });
  }
  return found;
}

/**
 * The card shows the attachment summary separately, so without this the preview repeats each
 * attachment and an image-heavy note pushes its own words out of the clamp.
 */
export function stripAttachmentNodes(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(PAIRED_ATTACHMENT_RE, '').replace(VOID_ATTACHMENT_RE, '');
}
