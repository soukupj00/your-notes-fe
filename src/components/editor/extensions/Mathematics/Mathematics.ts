import { InlineMath, type InlineMathOptions } from '@tiptap/extension-mathematics';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface MathematicsExtensionOptions extends InlineMathOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Mathematics = InlineMath.extend<MathematicsExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().insertInlineMath({ latex: 'x^2' }).run(),
          isActive: () => editor.isActive('inlineMath'),
          shortcutKeys: ['Mod', 'Shift', 'M'],
          icon: 'Sigma',
          tooltip: t('editor.math.tooltip'),
        },
      }),
    } as unknown as MathematicsExtensionOptions;
  },
});
