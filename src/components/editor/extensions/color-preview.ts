import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** A picker drag previews its colour as an inline decoration, so no mark or undo step is
 *  written until release commits it once.
 *  See src/components/editor/CLAUDE.md, Live color preview. */
export const colorPreviewKey = new PluginKey<DecorationSet>('colorPreview');

/** `null` clears the preview. */
export type ColorPreviewMeta = { from: number; to: number; style: string } | null;

export function previewColor(editor: Editor, meta: NonNullable<ColorPreviewMeta>): void {
  editor.view.dispatch(editor.state.tr.setMeta(colorPreviewKey, meta));
}

export function clearColorPreview(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta(colorPreviewKey, null));
}

/** The class makes ::selection transparent (globals.css), so the blurred editor's selection
 *  highlight does not hide the colour being previewed or committed. */
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
