import { Placeholder } from '@tiptap/extensions';
import type { Node } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { TFunction } from '../button-types';

/** One empty paragraph: `isEmpty` is also true of blank lines and of a new Checklist's first row. */
function isUntouched(doc: Node) {
  const only = doc.childCount === 1 ? doc.firstChild : null;
  return only?.type.name === 'paragraph' && only.content.size === 0;
}

/**
 * The untouched Body's hint, said twice: `Placeholder` marks the paragraph for `globals.css` to
 * draw, and the textbox carries the same words as `aria-placeholder`, since drawn `content` is
 * not text.
 */
export function createBodyHint(t: TFunction) {
  const hint = () => t('editor.placeholder');
  return Placeholder.extend({
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        ...(this.parent?.() ?? []),
        // A plugin, because TipTap spreads `editorProps.attributes` and so drops a function.
        new Plugin({
          props: {
            attributes: (state): Record<string, string> =>
              editor.isEditable && isUntouched(state.doc) ? { 'aria-placeholder': hint() } : {},
          },
        }),
      ];
    },
  }).configure({
    // Only a paragraph: the title has its own, and a prompt on every empty block would be noise.
    placeholder: ({ node }) => (node.type.name === 'paragraph' ? hint() : ''),
    showOnlyWhenEditable: true,
  });
}
