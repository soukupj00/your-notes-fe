import { type BoldOptions, Bold as TiptapBold } from '@tiptap/extension-bold';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface BoldExtensionOptions extends BoldOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Bold = TiptapBold.extend<BoldExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleBold(),
          isActive: () => editor.isActive('bold'),
          shortcutKeys: ['Mod', 'B'],
          icon: 'Bold',
          tooltip: t('editor.bold.tooltip'),
        },
      }),
    } as unknown as BoldExtensionOptions;
  },
});
