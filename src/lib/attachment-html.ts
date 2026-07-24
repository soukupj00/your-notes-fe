// Matches `data-attachment-id="{value}"` inside any tag. A regex is enough:
// the Body is our own serialized editor HTML, and we only read attribute values,
// never trust the markup. Generalizes to any attachment node (audio/video/file)
// because they all carry the same data-attachment-id marker.
//
// Two separate consts on purpose: a `g`-flagged regex has stateful `lastIndex`,
// which `.test()` mutates. Sharing one regex between `.test()` (bodyHasAttachment)
// and `matchAll()` (extractAttachmentIds) would silently drop matches depending on
// call order. `.test()` never needs `g`, and `matchAll()` always needs it - so each
// function gets its own regex and neither can corrupt the other's state.
const ATTACHMENT_ID_TEST_RE = /data-attachment-id="[^"]+"/;
const ATTACHMENT_ID_MATCH_ALL_RE = /data-attachment-id="([^"]+)"/g;

/** True when the Body HTML embeds at least one attachment node. */
export function bodyHasAttachment(html: string | null | undefined): boolean {
  if (!html) return false;
  return ATTACHMENT_ID_TEST_RE.test(html);
}

// Matches an <audio> tag that carries a data-attachment-id (our audio node's
// serialized form), regardless of attribute order. Non-global on purpose: only
// used with `.test()`, so no stateful lastIndex to leak (see note above).
const AUDIO_ATTACHMENT_RE = /<audio\b[^>]*\bdata-attachment-id="[^"]+"/i;

/** True when the Body HTML embeds at least one audio attachment node.
 *  Narrower than bodyHasAttachment, which also matches images. */
export function bodyHasAudio(html: string | null | undefined): boolean {
  if (!html) return false;
  return AUDIO_ATTACHMENT_RE.test(html);
}

// Matches a <video> tag that carries a data-attachment-id (our video node's
// serialized form), regardless of attribute order. Non-global on purpose: only
// used with `.test()`, so no stateful lastIndex to leak (see note above).
const VIDEO_ATTACHMENT_RE = /<video\b[^>]*\bdata-attachment-id="[^"]+"/i;

/** True when the Body HTML embeds at least one video attachment node.
 *  Narrower than bodyHasAttachment, which also matches images and audio. */
export function bodyHasVideo(html: string | null | undefined): boolean {
  if (!html) return false;
  return VIDEO_ATTACHMENT_RE.test(html);
}

// Matches an <a> tag that carries a data-attachment-id (our file node's
// serialized form), regardless of attribute order. Non-global on purpose: only
// used with `.test()`, so no stateful lastIndex to leak (see note above).
const FILE_ATTACHMENT_RE = /<a\b[^>]*\bdata-attachment-id="[^"]+"/i;

/** True when the Body HTML embeds at least one file attachment node.
 *  Narrower than bodyHasAttachment, which also matches images/audio/video. */
export function bodyHasFile(html: string | null | undefined): boolean {
  if (!html) return false;
  return FILE_ATTACHMENT_RE.test(html);
}

/** Every distinct attachment id referenced by the Body HTML. */
export function extractAttachmentIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(ATTACHMENT_ID_MATCH_ALL_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}
