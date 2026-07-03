import type { Editor } from '@tiptap/core';
import { Mathematics as TiptapMathematics } from '@tiptap/extension-mathematics';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView, TFunction } from '../button-types';

export interface MathematicsExtensionOptions {
  button: (context: ButtonContext) => ButtonView;
}

/** Prompt for LaTeX and insert an inline math node at the cursor. */
function insertMath(editor: Editor, t: TFunction) {
  const latex = window.prompt(t('editor.math.prompt'), '');
  if (latex) {
    editor.chain().focus().insertInlineMath({ latex }).run();
  }
}

/** Prompt to edit the LaTeX of an existing math node (wired via onClick below). */
function editMath(
  editor: Editor,
  kind: 'inlineMath' | 'blockMath',
  node: ProseMirrorNode,
  pos: number,
  t: TFunction
) {
  const latex = window.prompt(t('editor.math.prompt'), node.attrs.latex ?? '');
  if (latex === null) {
    return;
  }
  // Pass `pos` explicitly: without it the update command reads the original cursor
  // selection (not the clicked node) and would no-op inside a chain.
  if (kind === 'inlineMath') {
    editor.chain().updateInlineMath({ latex, pos }).focus().run();
  } else {
    editor.chain().updateBlockMath({ latex, pos }).focus().run();
  }
}

/**
 * The Mathematics extension (bundles inline + block math). Registering it enables
 * KaTeX rendering and the `$...$` / `$$...$$` input rules, so users can write LaTeX
 * directly. Adds a Pattern A toolbar button that prompts for LaTeX and inserts an
 * inline math node.
 */
export const Mathematics = TiptapMathematics.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => insertMath(editor, t),
          isActive: () => editor.isActive('inlineMath') || editor.isActive('blockMath'),
          icon: 'Latex',
          tooltip: t('editor.math.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as MathematicsExtensionOptions;
  },
});

/**
 * Build the configured Mathematics extension. `getEditor` returns the live editor
 * (not yet available when the extensions array is first constructed), and `t`
 * translates the prompt. Clicking a rendered math node prompts to edit its LaTeX;
 * invalid LaTeX renders as an error instead of throwing (`throwOnError: false`).
 */
export function createMathematics(getEditor: () => Editor | null, t: TFunction) {
  return Mathematics.configure({
    katexOptions: { throwOnError: false },
    inlineOptions: {
      onClick: (node, pos) => {
        const editor = getEditor();
        if (editor) {
          editMath(editor, 'inlineMath', node, pos, t);
        }
      },
    },
    blockOptions: {
      onClick: (node, pos) => {
        const editor = getEditor();
        if (editor) {
          editMath(editor, 'blockMath', node, pos, t);
        }
      },
    },
  });
}
