/**
 * Ticking a Checklist on a card, which has no ProseMirror to dispatch into, so it is a string
 * transformation on the stored Body (ADR 0013).
 */

const TASK_ITEM = 'li[data-type="taskItem"]';

/**
 * `index` is in document order, which the card shares: `stripAttachmentNodes` never drops an `li`.
 * `null` when already in that state, so a double tap does not bump `updatedAt`. Writes both
 * `data-checked` (TipTap reads it) and the input's `checked` (the card paints it).
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

  if ((item.getAttribute('data-checked') === 'true') === checked) return null;

  item.setAttribute('data-checked', String(checked));

  const box = item.querySelector('input[type="checkbox"]');
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
  const item = target.closest(TASK_ITEM);
  if (!item || !root.contains(item)) return null;
  const index = Array.from(root.querySelectorAll(TASK_ITEM)).indexOf(item);
  return index < 0 ? null : index;
}
