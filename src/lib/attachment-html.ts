// A regex is enough: the Body is our own editor's HTML and only attribute values are read.
// Two regexes on purpose: `.test()` mutates a `g` regex's `lastIndex`, so sharing one with
// `matchAll()` would silently drop matches depending on call order.
const ATTACHMENT_ID_TEST_RE = /data-attachment-id="[^"]+"/;
const ATTACHMENT_ID_MATCH_ALL_RE = /data-attachment-id="([^"]+)"/g;

export function bodyHasAttachment(html: string | null | undefined): boolean {
  if (!html) return false;
  return ATTACHMENT_ID_TEST_RE.test(html);
}

export function extractAttachmentIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(ATTACHMENT_ID_MATCH_ALL_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}
