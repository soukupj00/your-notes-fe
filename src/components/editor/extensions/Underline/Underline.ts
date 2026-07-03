import { Underline as TiptapUnderline, type UnderlineOptions } from '@tiptap/extension-underline';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface UnderlineExtensionOptions extends UnderlineOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Underline = TiptapUnderline.extend<UnderlineExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleUnderline(),
          isActive: () => editor.isActive('underline'),
          shortcutKeys: ['Mod', 'U'],
          icon: 'Underline',
          tooltip: t('editor.underline.tooltip'),
        },
      }),
    } as unknown as UnderlineExtensionOptions;
  },
});
