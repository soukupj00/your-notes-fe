import type { Editor } from '@tiptap/core';
import { Mathematics as TiptapMathematics } from '@tiptap/extension-mathematics';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView, TFunction } from '../button-types';
import { askText } from '../TextPrompt/textPrompt';

export interface MathematicsExtensionOptions {
  button: (context: ButtonContext) => ButtonView;
}

export async function insertMath(editor: Editor, t: TFunction) {
  const latex = await askText(editor, {
    kind: 'math',
    title: t('editor.math.prompt'),
    confirmLabel: t('editor.math.insert'),
  });
  if (latex?.trim()) editor.chain().focus().insertInlineMath({ latex }).run();
}

async function editMath(
  editor: Editor,
  kind: 'inlineMath' | 'blockMath',
  node: ProseMirrorNode,
  pos: number,
  t: TFunction
) {
  const latex = await askText(editor, {
    kind: 'math',
    title: t('editor.math.prompt'),
    confirmLabel: t('editor.math.apply'),
    initial: node.attrs.latex ?? '',
  });
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

export const Mathematics = TiptapMathematics.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => void insertMath(editor, t),
          isActive: () => editor.isActive('inlineMath') || editor.isActive('blockMath'),
          icon: 'Latex',
          tooltip: t('editor.math.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as MathematicsExtensionOptions;
  },
});

/** `getEditor` is a getter because the editor does not exist yet when this is built. */
export function createMathematics(getEditor: () => Editor | null, t: TFunction) {
  return Mathematics.configure({
    katexOptions: { throwOnError: false },
    inlineOptions: {
      onClick: (node, pos) => {
        const editor = getEditor();
        if (editor) {
          void editMath(editor, 'inlineMath', node, pos, t);
        }
      },
    },
    blockOptions: {
      onClick: (node, pos) => {
        const editor = getEditor();
        if (editor) {
          void editMath(editor, 'blockMath', node, pos, t);
        }
      },
    },
  });
}
