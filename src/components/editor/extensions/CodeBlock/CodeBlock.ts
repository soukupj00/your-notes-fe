import { type CodeBlockOptions, CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface CodeBlockExtensionOptions extends CodeBlockOptions {
  button: (context: ButtonContext) => ButtonView;
}

/** Plain, not the lowlight variant: highlighting would pull in a grammar bundle for a block
 *  that mostly holds a command or a snippet verbatim. */
export const CodeBlock = TiptapCodeBlock.extend<CodeBlockExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleCodeBlock(),
          isActive: () => editor.isActive('codeBlock'),
          shortcutKeys: ['Mod', 'Alt', 'C'],
          icon: 'Code2',
          tooltip: t('editor.codeBlock.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as CodeBlockExtensionOptions;
  },
});
