import { type CodeOptions, Code as TiptapCode } from '@tiptap/extension-code';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface CodeExtensionOptions extends CodeOptions {
  button: (context: ButtonContext) => ButtonView;
}

/** Inline `code` mark - the short-span sibling of the block-level CodeBlock. */
export const Code = TiptapCode.extend<CodeExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleCode(),
          isActive: () => editor.isActive('code'),
          shortcutKeys: ['Mod', 'E'],
          icon: 'Code',
          tooltip: t('editor.code.tooltip'),
          toggle: true,
        },
        hideOnMobile: true,
      }),
    } as unknown as CodeExtensionOptions;
  },
});
