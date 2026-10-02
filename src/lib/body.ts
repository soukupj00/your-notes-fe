import { ATTACHMENT_KINDS, type AttachmentKind } from '@/models.ts';
import { ATTACHMENT_SPECS } from './attachments.ts';

/** The attribute every attachment node carries: the Body holds the id, never the bytes (ADR 0007). */
export const ATTACHMENT_ID_ATTR = 'data-attachment-id';
export const TASK_LIST = 'ul[data-type="taskList"]';
export const TASK_ITEM = 'li[data-type="taskItem"]';
const TASK_BOX = 'input[type="checkbox"]';

// A regex is enough: the Body is our own editor's HTML and only attribute values are read.
// One regex per use: `.test()` mutates a `g` regex's `lastIndex`, so sharing one with
// `matchAll()` would silently drop matches depending on call order.
const ATTACHMENT_ID_TEST_RE = new RegExp(`${ATTACHMENT_ID_ATTR}="[^"]+"`);
const ATTACHMENT_ID_MATCH_ALL_RE = new RegExp(`${ATTACHMENT_ID_ATTR}="([^"]+)"`, 'g');

/** The tags the editor emits, read back to the stored kind, from the same table the editor writes by. */
const KIND_BY_TAG = new Map(ATTACHMENT_KINDS.map((kind) => [ATTACHMENT_SPECS[kind].tag, kind]));
const TAGS = [...KIND_BY_TAG.keys()];
const ATTACHMENT_NODE_RE = new RegExp(
  `<(${TAGS.join('|')})\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="([^"]+)"`,
  'gi'
);
// Void and paired forms strip differently: an <img> is the whole node, while the other tags wrap
// content that has to go with them. Our attachment nodes are always leaves, so a non-greedy match
// to the first matching close tag is safe.
const VOID_ATTACHMENT_RE = new RegExp(`<img\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="[^"]+"[^>]*>`, 'gi');
const PAIRED_ATTACHMENT_RE = new RegExp(
  `<(${TAGS.filter((tag) => tag !== 'img').join('|')})\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="[^"]+"[^>]*>[\\s\\S]*?<\\/\\1>`,
  'gi'
);

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

/**
 * The Body is the authority on order and kind, because the card (`CardMedia`) needs both before
 * the rows resolve, even for a deleted row. The row only supplies bytes.
 */
export interface BodyAttachment {
  id: string;
  kind: AttachmentKind;
}

/** Skips an unknown tag, so a future node type shows "no preview" rather than the wrong one. */
export function extractBodyAttachments(html: string | null | undefined): BodyAttachment[] {
  if (!html) return [];
  const seen = new Set<string>();
  const found: BodyAttachment[] = [];
  for (const match of html.matchAll(ATTACHMENT_NODE_RE)) {
    const kind = KIND_BY_TAG.get(match[1].toLowerCase());
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

/** Points every reference to `from` at `to`: a Conflicted Copy's clones take new ids. */
export function repointAttachment(html: string, from: string, to: string): string {
  return html.replaceAll(`${ATTACHMENT_ID_ATTR}="${from}"`, `${ATTACHMENT_ID_ATTR}="${to}"`);
}

/**
 * A checklist as TipTap serialises it, so a hand-built Body round-trips unchanged (pinned in
 * `body.test.ts`). An item carries its state twice (`data-checked` for TipTap, the input's
 * `checked` for the card). `label` is markup, not text: callers pass translated strings or ''.
 */
export function taskListMarkup(items: [label: string, checked: boolean][]): string {
  const item = ([label, checked]: [string, boolean]) =>
    `<li data-checked="${checked}" data-type="taskItem">` +
    `<label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label>` +
    `<div><p>${label}</p></div></li>`;
  return `<ul data-type="taskList">${items.map(item).join('')}</ul>`;
}

export function closestChecklistItem(target: Element): Element | null {
  return target.closest(TASK_ITEM);
}

export function isChecklistItemChecked(item: Element): boolean {
  return item.getAttribute('data-checked') === 'true';
}

export function checklistBox(item: Element): HTMLInputElement | null {
  return item.querySelector<HTMLInputElement>(TASK_BOX);
}

/**
 * Ticks a Checklist on a card, which has no ProseMirror, so it edits the stored Body (ADR 0013).
 * `index` is in document order, which `stripAttachmentNodes` keeps: it never drops an `li`.
 * `null` when already in that state, so a double tap does not bump `updatedAt`.
 */
export function setChecklistItemChecked(
  html: string,
  index: number,
  checked: boolean
): string | null {
  if (index < 0) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const item = doc.querySelectorAll(TASK_ITEM)[index];
  if (!item) return null;

  if (isChecklistItemChecked(item) === checked) return null;

  item.setAttribute('data-checked', String(checked));

  const box = checklistBox(item);
  if (box) {
    if (checked) box.setAttribute('checked', '');
    else box.removeAttribute('checked');
  }

  return doc.body.innerHTML;
}

/**
 * Counted as `setChecklistItemChecked` counts. Read from the DOM because the card's body is
 * `innerHTML`, with no React elements to hang a handler or key on.
 */
export function checklistItemIndexAt(root: ParentNode, target: Element): number | null {
  const item = closestChecklistItem(target);
  if (!item || !root.contains(item)) return null;
  const index = Array.from(root.querySelectorAll(TASK_ITEM)).indexOf(item);
  return index < 0 ? null : index;
}
