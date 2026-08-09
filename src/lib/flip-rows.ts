/**
 * FLIP for checklist rows (ADR 0013).
 *
 * Sinking is a CSS `order` rule, and `order` does not animate: a ticked row
 * teleports past its neighbours, which on a long list leaves no clue where it
 * went. FLIP is what puts the travel back - measure before, let the rule
 * re-lay-out, measure after, then play the difference away.
 *
 * **Rows are matched by index, not identity**, and that is the whole reason one
 * helper serves both surfaces. In the editor ProseMirror updates the `li` in
 * place, so the node survives; on a card `NoteBody` re-sets `innerHTML` and
 * every node is replaced. FLIP needs only *correspondence*, and since a toggle
 * changes nothing but an attribute, the k-th row before and after is the same
 * logical item either way.
 */

const TASK_LIST = 'ul[data-type="taskList"]';

/**
 * Row offsets per checklist: `snapshot[listIndex][rowIndex]` is that row's top
 * relative to its own list's top.
 *
 * Offsets rather than viewport coordinates, because capture and play are not
 * always in the same frame - a card persists through Dexie in between - and an
 * absolute top would fold any scrolling or card movement into the delta and
 * animate rows that never moved.
 */
export type RowSnapshot = number[][];

/** Direct row children only: a nested checklist is its own list, with its own seam. */
function rowsOf(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > li'));
}

function listsOf(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TASK_LIST));
}

/** Where every checklist row sits right now. Call before the change. */
export function captureRows(root: ParentNode): RowSnapshot {
  return listsOf(root).map((list) => {
    const listTop = list.getBoundingClientRect().top;
    return rowsOf(list).map((row) => row.getBoundingClientRect().top - listTop);
  });
}

/**
 * Animate every row from where `before` says it was to where it is now.
 *
 * The ticked row is not the only one that moves: everything it travels past
 * shifts up or down a slot, and animating all of them is what makes the motion
 * read as a list re-settling rather than one row jumping.
 *
 * Callers gate this on reduced motion; it is not checked here, so the helper
 * stays pure DOM arithmetic with no preference plumbing of its own.
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
      // A row with no counterpart is new. It has nowhere to travel from, and
      // sliding it in from an invented offset would be motion the user did not
      // cause.
      if (was === undefined) return;

      const delta = was - (row.getBoundingClientRect().top - listTop);
      // Sub-pixel deltas are rounding, not movement, and animating them would
      // spend an animation on every row of every list on every tick.
      if (Math.abs(delta) < 0.5) return;
      if (typeof row.animate !== 'function') return;

      row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration,
        easing,
      });
    });
  });
}
