import type { ChainedCommands, Editor } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';

const LIST_NODE_TYPES = ['bulletList', 'orderedList', 'taskList'];

/** `Selection.near` snaps the list's bounds to valid text positions: selecting the raw node
 *  boundaries misbehaves once the list is not the document's first node. */
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

/** A collapsed cursor converts the whole list: switching to or from `taskList` (which uses
 *  `taskItem`) would otherwise convert one item and split the list. A real selection is
 *  respected as-is. */
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
