import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Live color-preview decoration for the custom color pickers (text color + highlight).
 *
 * While the user drags the react-colorful picker we want the selected text to show the
 * candidate color in real time - but without committing a mark or polluting the undo
 * history on every mouse move. This extension holds a single inline `Decoration` (an
 * ephemeral inline style over a range) driven entirely by transaction meta: dragging sets
 * the preview, releasing/closing clears it, and only then is the real mark committed once.
 */
export const colorPreviewKey = new PluginKey<DecorationSet>('colorPreview');

/** Meta payload: a range + the inline CSS to paint on it, or `null` to clear. */
export type ColorPreviewMeta = { from: number; to: number; style: string } | null;

/** Paint `style` (e.g. `color: #f00` / `background-color: #ff0`) over the given range. */
export function previewColor(editor: Editor, meta: NonNullable<ColorPreviewMeta>): void {
  editor.view.dispatch(editor.state.tr.setMeta(colorPreviewKey, meta));
}

/** Remove any active preview decoration. */
export function clearColorPreview(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta(colorPreviewKey, null));
}

/**
 * Toggle the `color-picking` class on the editor DOM while a picker popover is open. It
 * makes the native ::selection highlight transparent (see globals.css) so the live preview
 * and the freshly-committed color are visible across the whole still-selected multi-line
 * range, instead of being masked by the browser's selection highlight on the blurred editor.
 */
export function setColorPicking(editor: Editor, active: boolean): void {
  editor.view.dom.classList.toggle('color-picking', active);
}

export const ColorPreview = Extension.create({
  name: 'colorPreview',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: colorPreviewKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(colorPreviewKey) as ColorPreviewMeta | undefined;
            // No preview change in this transaction - just keep the decoration in sync with edits.
            if (meta === undefined) {
              return old.map(tr.mapping, tr.doc);
            }
            if (meta === null) {
              return DecorationSet.empty;
            }
            return DecorationSet.create(tr.doc, [
              Decoration.inline(meta.from, meta.to, { style: meta.style }),
            ]);
          },
        },
        props: {
          decorations(state) {
            return colorPreviewKey.getState(state);
          },
        },
      }),
    ];
  },
});

export default ColorPreview;
