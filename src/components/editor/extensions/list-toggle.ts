import type { ChainedCommands, Editor } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';

const LIST_NODE_TYPES = ['bulletList', 'orderedList', 'taskList'];

/**
 * Returns a text-selection range spanning the entire list the cursor sits in, or
 * null if the cursor is not inside a list. Walks up to the nearest ancestor list
 * node and snaps the list's content boundaries inward to valid text positions with
 * `Selection.near` (selecting the raw node boundaries directly misbehaves once the
 * list is not the first node in the document).
 */
function wholeListSelection(editor: Editor): { from: number; to: number } | null {
  const { $from } = editor.state.selection;
  const { doc } = editor.state;
  for (let depth = $from.depth; depth > 0; depth--) {
    if (LIST_NODE_TYPES.includes($from.node(depth).type.name)) {
      const from = Selection.near(doc.resolve($from.start(depth)), 1).from;
      const to = Selection.near(doc.resolve($from.end(depth)), -1).to;
      return { from, to };
    }
  }
  return null;
}

/**
 * Toggle a list type operating on the WHOLE list when the selection is collapsed
 * inside one. Switching bullet <-> ordered already converts the whole list because
 * they share `listItem`, but switching to/from `taskList` (which uses `taskItem`)
 * would otherwise convert only the current item and split the list. Expanding a
 * collapsed cursor to the full list first makes every list-type switch (and
 * toggle-off) act on the entire list, consistently.
 *
 * With a real (non-empty) selection, the caller's selection is respected as-is.
 */
export function toggleWholeList(
  editor: Editor,
  applyToggle: (chain: ChainedCommands) => ChainedCommands
): boolean {
  let chain = editor.chain().focus();
  if (editor.state.selection.empty) {
    const range = wholeListSelection(editor);
    if (range) {
      chain = chain.setTextSelection(range);
    }
  }
  return applyToggle(chain).run();
}
