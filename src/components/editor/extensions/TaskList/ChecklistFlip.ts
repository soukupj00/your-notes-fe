import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';
import { captureRows, playRows, type RowSnapshot } from '@/lib/flip-rows.ts';

export interface ChecklistFlipOptions {
  /**
   * Whether a toggle should animate. Read on every toggle rather than captured
   * once: reduced motion can be switched while a note is open, and the
   * extensions array is built once per editor.
   */
  animate: () => boolean;
}

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
 *
 * Exported for its own tests: it is the subtle half of this extension, and the
 * half jsdom can actually exercise (the animation needs real layout).
 */
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

/**
 * Animates a checklist re-settling when an item is ticked.
 *
 * Sinking itself is a CSS `order` rule (ADR 0013), which means the document
 * never changes shape and this extension moves nothing: the row is already in
 * its new slot by the time the browser paints. What is missing without this is
 * the *travel* - `order` re-lays-out instantly, so the row teleports and the
 * eye loses it. FLIP puts the journey back.
 *
 * The timing is the reason this is a plugin rather than a React effect.
 * `appendTransaction` runs while the new state is being applied but **before**
 * the view writes it to the DOM, so it is the last moment the old geometry can
 * be read; the plugin view's `update` runs immediately after, when the new
 * geometry is available. Nothing else in ProseMirror's lifecycle straddles the
 * DOM write like that.
 *
 * It returns `null` from `appendTransaction` always - it appends no transaction
 * and exists purely for that timing.
 */
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
