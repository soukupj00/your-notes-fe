import { type CodeBlockOptions, CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface CodeBlockExtensionOptions extends CodeBlockOptions {
  button: (context: ButtonContext) => ButtonView;
}

/**
 * Plain (unhighlighted) code block. Deliberately not the lowlight variant:
 * syntax highlighting would pull a language grammar bundle into a note-taking
 * app for a block that is mostly used to hold a command or a snippet verbatim.
 */
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
        hideOnMobile: true,
      }),
    } as unknown as CodeBlockExtensionOptions;
  },
});
