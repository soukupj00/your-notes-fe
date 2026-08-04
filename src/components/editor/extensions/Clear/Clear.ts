import { Extension } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface ClearExtensionOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Clear = Extension.create<ClearExtensionOptions>({
  name: 'clear',
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
          icon: 'RemoveFormatting',
          shortcutKeys: ['Mod', '\\'],
          tooltip: t('editor.clearFormatting.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as ClearExtensionOptions;
  },
});
