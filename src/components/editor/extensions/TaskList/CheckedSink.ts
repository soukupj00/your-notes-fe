import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';

export interface CheckedSinkOptions {
  /**
   * Read on every toggle rather than captured once: the preference can be
   * switched while a note is open, and the extensions array is built once per
   * editor.
   */
  enabled: () => boolean;
}

/**
 * Our own reordering, flagged so the pass it triggers doesn't read the move as a
 * fresh toggle and chase it around the list.
 */
const SINK_META = 'checkedSink';

/** A task item whose checkbox just changed, and which way. */
interface Toggled {
  pos: number;
  checked: boolean;
}

/**
 * The task item whose `checked` attribute changed in this round of
 * transactions, or `null` if none did.
 *
 * Deliberately compares documents instead of reading the steps. A checkbox
 * toggle reaches the document as `setNodeMarkup`, which prosemirror expresses as
 * a structural step rather than as "this attribute changed", so a step-shaped
 * test would be reading an implementation detail of a library two levels down.
 * Old positions are mapped forward first, so the comparison survives a toggle
 * that arrives alongside an edit elsewhere in the note.
 */
function findToggledItem(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState
): Toggled | null {
  const mapping = new Mapping();
  for (const transaction of transactions) mapping.appendMapping(transaction.mapping);

  const before = new Map<number, boolean>();
  oldState.doc.descendants((node, pos) => {
    if (node.type.name !== 'taskItem') return;
    before.set(mapping.map(pos), node.attrs.checked === true);
  });

  let toggled: Toggled | null = null;
  newState.doc.descendants((node, pos) => {
    if (toggled) return false;
    if (node.type.name !== 'taskItem') return;
    const was = before.get(pos);
    // An item with no counterpart is a *new* item, not a toggled one.
    if (was === undefined) return;
    const now = node.attrs.checked === true;
    if (was !== now) toggled = { pos, checked: now };
  });

  return toggled;
}

/** Document position of the list's child at `index`. */
function childStart(listStart: number, list: ProseMirrorNode, index: number): number {
  let position = listStart;
  for (let i = 0; i < index; i++) position += list.child(i).nodeSize;
  return position;
}

/**
 * Move the toggled item to where its new state says it belongs, or `null` when
 * that is already where it is.
 *
 * Checking sinks the item below every sibling; unchecking floats it back to the
 * top of the checked block rather than leaving it stranded among items it no
 * longer belongs with, so a mistaken tap is undone by tapping again.
 */
function sinkTransaction(state: EditorState, { pos, checked }: Toggled): Transaction | null {
  const $pos = state.doc.resolve(pos);
  const list = $pos.parent;
  // The item's *own* list, which for a nested checklist is the sub-list. An item
  // that sank past its parent would leave the group it belongs to.
  if (list.type.name !== 'taskList') return null;

  const item = state.doc.nodeAt(pos);
  if (!item) return null;

  const index = $pos.index();
  const others: number[] = [];
  for (let i = 0; i < list.childCount; i++) if (i !== index) others.push(i);

  // Checked items live at the bottom, so the landing index is either the very
  // end or the seam between the two blocks.
  const target = checked
    ? others.length
    : others.filter((i) => list.child(i).attrs.checked !== true).length;

  const insertAt =
    target < others.length ? childStart($pos.start(), list, others[target]) : $pos.end();
  if (insertAt === pos) return null;

  // The caret is a place in the note, not a place in the tree: if it sits in the
  // item being moved it has to travel with it.
  const caretOffset =
    state.selection.from > pos && state.selection.from < pos + item.nodeSize
      ? state.selection.from - pos
      : null;

  const tr = state.tr.setMeta(SINK_META, true);
  tr.delete(pos, pos + item.nodeSize);
  const landing = tr.mapping.map(insertAt);
  tr.insert(landing, item);
  if (caretOffset !== null) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(landing + caretOffset)));
  }

  return tr;
}

/**
 * Keeps a checklist sorted as it is used: a checked item drops to the bottom of
 * its list, an unchecked one comes back up.
 *
 * Off by default and gated on a preference, because it is a real opinion about
 * what a list is for. A shopping list wants the done things out of the way; a
 * ranked list of options wants its order left exactly where the user put it, and
 * silently rewriting that order would be the app losing the user's work.
 */
export const CheckedSink = Extension.create<CheckedSinkOptions>({
  name: 'checkedSink',

  addOptions() {
    return { enabled: () => false };
  },

  addProseMirrorPlugins() {
    const { enabled } = this.options;

    return [
      new Plugin({
        key: new PluginKey('checkedSink'),
        appendTransaction(transactions, oldState, newState) {
          if (!enabled()) return null;
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          if (transactions.some((transaction) => transaction.getMeta(SINK_META))) return null;

          const toggled = findToggledItem(transactions, oldState, newState);
          return toggled ? sinkTransaction(newState, toggled) : null;
        },
      }),
    ];
  },
});
