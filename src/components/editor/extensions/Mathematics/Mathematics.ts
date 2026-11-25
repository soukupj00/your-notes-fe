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

type MathKind = 'inlineMath' | 'blockMath';

async function editMath(
  editor: Editor,
  kind: MathKind,
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
  const update = kind === 'inlineMath' ? 'updateInlineMath' : 'updateBlockMath';
  // Pass `pos` explicitly: without it the update command reads the original cursor
  // selection (not the clicked node) and would no-op inside a chain.
  editor.chain()[update]({ latex, pos }).focus().run();
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
          toggleLook: true,
        },
      }),
    } as unknown as MathematicsExtensionOptions;
  },
});

/** `getEditor` is a getter because the editor does not exist yet when this is built. */
export function createMathematics(getEditor: () => Editor | null, t: TFunction) {
  const onClick = (kind: MathKind) => (node: ProseMirrorNode, pos: number) => {
    const editor = getEditor();
    if (editor) void editMath(editor, kind, node, pos, t);
  };
  return Mathematics.configure({
    katexOptions: { throwOnError: false },
    inlineOptions: { onClick: onClick('inlineMath') },
    blockOptions: { onClick: onClick('blockMath') },
  });
}
