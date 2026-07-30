import type { AttachmentKind } from '@/models.ts';

/**
 * An attachment the Body references, in document order.
 *
 * The card summarises attachments rather than rendering them inline (see
 * `CardMedia`), so it needs to know *what* a note carries before the Dexie rows
 * resolve - and it needs the kind even for a row that has since been deleted.
 * The Body is the authority on both order and kind; the row only supplies bytes.
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

// Same trust model as `attachment-html.ts`: the Body is our own editor output
// and we only ever read attribute values, never execute the markup. Kept as its
// own `g`-flagged const because `matchAll` needs the flag and `.test()` callers
// must not inherit its stateful `lastIndex`.
const ATTACHMENT_NODE_RE =
  /<(img|video|audio|a|excalidraw-drawing)\b[^>]*\bdata-attachment-id="([^"]+)"/gi;

// Void and paired forms strip differently: an <img> is the whole node, while the
// other four wrap content that has to go with them. Our attachment nodes are
// always leaves, so a non-greedy match to the first matching close tag is safe.
const VOID_ATTACHMENT_RE = /<img\b[^>]*\bdata-attachment-id="[^"]+"[^>]*>/gi;
const PAIRED_ATTACHMENT_RE =
  /<(video|audio|a|excalidraw-drawing)\b[^>]*\bdata-attachment-id="[^"]+"[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Every attachment the Body references, in document order, deduplicated by id.
 * An unknown tag is skipped rather than guessed at, so a future node type shows
 * up as "no preview" instead of as the wrong preview.
 */
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
 * The Body with every attachment node removed, leaving the prose.
 *
 * The card renders the summary and the text as two separate blocks, so without
 * this the text preview would show each attachment a second time - and an
 * image-heavy note would push its own words off the bottom of the clamp.
 */
export function stripAttachmentNodes(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(PAIRED_ATTACHMENT_RE, '').replace(VOID_ATTACHMENT_RE, '');
}
