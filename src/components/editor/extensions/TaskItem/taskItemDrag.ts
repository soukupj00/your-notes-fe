/**
 * The child index an item takes after being removed and dropped after `slot` of
 * its `candidates` - the rows it may land among, as **stored** indices in
 * **visual** order. Indices above the item's own shift down by one once it is
 * gone, which is the whole of the arithmetic.
 */
export function dropIndex(stored: number, candidates: number[], slot: number): number {
  if (candidates.length === 0) return stored;
  const afterRemoval = (index: number) => (index > stored ? index - 1 : index);
  if (slot < candidates.length) return afterRemoval(candidates[slot]);
  return afterRemoval(candidates[candidates.length - 1]) + 1;
}

export interface TaskItemDragArgs {
  /** The pointerdown that begins the gesture, on the grip. */
  event: PointerEvent;
  /** The `<li>` being dragged. */
  item: HTMLElement;
  /** Called on drop with the child index for `moveTaskItem`, or not at all when nothing moved. */
  onDrop: (to: number) => void;
}

const DRAGGING = 'task-item-dragging';
const DROP_BEFORE = 'task-item-drop-before';
const DROP_AFTER = 'task-item-drop-after';

/**
 * Reorder by pointer, not by HTML5 drag. HTML5 drag never fires on touch, which
 * is why the previous grip could not move a row on a phone; pointer events are
 * the one model a finger and a mouse share.
 *
 * The row travels with the pointer (a transform, so the document is untouched
 * until the drop) and a line marks the slot it will land in. The slot is
 * chosen among the row's own group - with sinking on, checked rows are shown
 * apart from unchecked ones (ADR 0013), so a row only ever lands among rows it
 * is displayed with, and `dropIndex` maps the visual slot back to stored order.
 */
export function startTaskItemDrag({ event, item, onDrop }: TaskItemDragArgs): void {
  const list = item.parentElement;
  if (!list) return;
  const grip = event.currentTarget as HTMLElement;
  const siblings = () => Array.from(list.children);
  const rows = siblings().filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== item
  );
  const group = item.dataset.checked;
  const sinking = document.documentElement.hasAttribute('data-sink-checked');
  const candidates = rows
    .filter((row) => !sinking || row.dataset.checked === group)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const stored = siblings().indexOf(item);
  const storedOf = (row: HTMLElement) => siblings().indexOf(row);

  const startY = event.clientY;
  // Where the row already sits among its candidates, so a drop back into the
  // same slot is a no-op rather than a spurious transaction.
  const itemTop = item.getBoundingClientRect().top;
  let slot = candidates.filter((row) => row.getBoundingClientRect().top < itemTop).length;
  const initialSlot = slot;

  const clearMarks = () => {
    for (const row of candidates) row.classList.remove(DROP_BEFORE, DROP_AFTER);
  };
  const mark = () => {
    clearMarks();
    if (candidates.length === 0) return;
    if (slot < candidates.length) candidates[slot].classList.add(DROP_BEFORE);
    else candidates[candidates.length - 1].classList.add(DROP_AFTER);
  };

  const onMove = (move: PointerEvent) => {
    item.style.transform = `translateY(${move.clientY - startY}px)`;
    slot = candidates.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < move.clientY;
    }).length;
    mark();
  };

  const finish = (dropped: boolean) => {
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    grip.removeEventListener('pointercancel', onCancel);
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    item.style.transform = '';
    item.classList.remove(DRAGGING);
    clearMarks();
    if (dropped && slot !== initialSlot) {
      onDrop(dropIndex(stored, candidates.map(storedOf), slot));
    }
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  event.preventDefault();
  grip.setPointerCapture(event.pointerId);
  item.classList.add(DRAGGING);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onCancel);
}
