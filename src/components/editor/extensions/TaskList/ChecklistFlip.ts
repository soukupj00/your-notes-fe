import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';
import { captureRows, playRows, type RowSnapshot } from '@/lib/flip-rows.ts';

export interface ChecklistFlipOptions {
  /** Read on every toggle, not captured: reduced motion can change while a note is open. */
  animate: () => boolean;
}

interface Toggled {
  pos: number;
  checked: boolean;
}

/** Compares documents rather than reading steps, because a toggle arrives as a structural
 *  `setNodeMarkup` step. Old positions are mapped forward first, so an edit elsewhere in
 *  the same round does not hide the toggle. */
export function findToggledItem(
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

/** Animates a ticked row's travel; the sinking itself is CSS `order` (ADR 0013).
 *  A plugin for its timing: old geometry is read before the DOM write, new after.
 *  See src/components/editor/CLAUDE.md, Checklist behaviour. */
export const ChecklistFlip = Extension.create<ChecklistFlipOptions>({
  name: 'checklistFlip',

  addOptions() {
    return { animate: () => false };
  },

  addProseMirrorPlugins() {
    const { animate } = this.options;
    // Per editor, because `addProseMirrorPlugins` runs once per editor instance.
    let view: EditorView | null = null;
    let pending: RowSnapshot | null = null;

    return [
      new Plugin({
        key: new PluginKey('checklistFlip'),

        appendTransaction(transactions, oldState, newState) {
          if (!view || !animate()) return null;
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          if (!findToggledItem(transactions, oldState, newState)) return null;
          pending = captureRows(view.dom);
          return null;
        },

        view(editorView) {
          view = editorView;
          return {
            update() {
              if (!pending || !view) return;
              const before = pending;
              pending = null;
              playRows(view.dom, before);
            },
            destroy() {
              view = null;
              pending = null;
            },
          };
        },
      }),
    ];
  },
});
