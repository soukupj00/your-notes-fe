import { type ItalicOptions, Italic as TiptapItalic } from '@tiptap/extension-italic';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface ItalicExtensionOptions extends ItalicOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Italic = TiptapItalic.extend<ItalicExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleItalic(),
          isActive: () => editor.isActive('italic'),
          shortcutKeys: ['Mod', 'I'],
          icon: 'Italic',
          tooltip: t('editor.italic.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as ItalicExtensionOptions;
  },
});
