/**
 * FLIP for checklist rows, because Sinking's CSS `order` does not animate (ADR 0013). Rows match by
 * index, not identity: a card replaces every node on a tick while the editor keeps them, and a
 * toggle changes only an attribute, so the k-th row is the same item either way.
 */

import { TASK_LIST } from '@/lib/body.ts';

/**
 * `snapshot[listIndex][rowIndex]` is a row's top relative to its own list. Not viewport tops: a
 * card persists through Dexie between capture and play, and scrolling would animate still rows.
 */
export type RowSnapshot = number[][];

/** Direct row children only: a nested checklist is its own list, with its own seam. */
function rowsOf(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > li'));
}

function listsOf(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TASK_LIST));
}

/** Call before the change. */
export function captureRows(root: ParentNode): RowSnapshot {
  return listsOf(root).map((list) => {
    const listTop = list.getBoundingClientRect().top;
    return rowsOf(list).map((row) => row.getBoundingClientRect().top - listTop);
  });
}

/**
 * Animates every row that moved, not just the ticked one, so the list reads as re-settling.
 * Callers gate this on reduced motion; it stays pure DOM arithmetic.
 */
export function playRows(
  root: ParentNode,
  before: RowSnapshot,
  { duration = 200, easing = 'cubic-bezier(0.65, 0, 0.35, 1)' } = {}
): void {
  listsOf(root).forEach((list, listIndex) => {
    const previous = before[listIndex];
    if (!previous) return;

    const listTop = list.getBoundingClientRect().top;
    rowsOf(list).forEach((row, rowIndex) => {
      const was = previous[rowIndex];
      // A new row has nowhere to travel from; inventing an offset is motion the user did not cause.
      if (was === undefined) return;

      const delta = was - (row.getBoundingClientRect().top - listTop);
      // Sub-pixel deltas are rounding, not movement.
      if (Math.abs(delta) < 0.5) return;
      if (typeof row.animate !== 'function') return;

      row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration,
        easing,
      });
    });
  });
}
