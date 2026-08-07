/**
 * Editing a Checklist from outside the Editor (ADR 0013).
 *
 * A card renders the stored Body HTML directly, with no ProseMirror instance to
 * dispatch a command into, so ticking a box there is a string transformation:
 * parse, flip one item, serialise. Kept pure and away from React so the rule the
 * card and the editor have to agree on is testable on its own.
 */

const TASK_ITEM = 'li[data-type="taskItem"]';

/**
 * The Body with one checklist item set to `checked`, or `null` when there is
 * nothing to do.
 *
 * `index` counts task items in **document order**, nested lists included. That
 * is the same order a card's DOM has, because `stripAttachmentNodes` only ever
 * removes media nodes and never an `li`, so an index taken from the rendered
 * card addresses the same item in the stored Body.
 *
 * Returning `null` when the item is already in the target state is the stale
 * guard: a double tap, or a live-query echo arriving after the user has moved
 * on, must not write an identical Body and bump `updatedAt` for nothing.
 *
 * Both `data-checked` and the input's `checked` attribute are written. They
 * carry the same fact for different readers - TipTap parses the first, the card
 * paints the second - and writing only one makes the two surfaces disagree.
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
 * The index of the task item a click landed in, or `null` if it did not land in
 * one - counted the same way `setChecklistItemChecked` counts.
 *
 * Taken from the DOM rather than from a React key because the card's body is set
 * as `innerHTML`, so there are no React elements to hang a handler or a key on;
 * one delegated listener per card and this lookup is the whole mechanism.
 */
export function checklistItemIndexAt(root: ParentNode, target: Element): number | null {
  const item = target.closest(TASK_ITEM);
  if (!item || !root.contains(item)) return null;
  const index = Array.from(root.querySelectorAll(TASK_ITEM)).indexOf(item);
  return index < 0 ? null : index;
}
