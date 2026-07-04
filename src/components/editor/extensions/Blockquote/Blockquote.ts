import {
  type BlockquoteOptions,
  Blockquote as TiptapBlockquote,
} from '@tiptap/extension-blockquote';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface BlockquoteExtensionOptions extends BlockquoteOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Blockquote = TiptapBlockquote.extend<BlockquoteExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleBlockquote(),
          isActive: () => editor.isActive('blockquote'),
          shortcutKeys: ['Mod', 'Shift', 'B'],
          icon: 'Quote',
          tooltip: t('editor.blockquote.tooltip'),
          toggle: true,
        },
        // Mobile-first: hidden below `sm` to keep the mobile toolbar lean (Balanced preset).
        hideOnMobile: true,
      }),
    } as unknown as BlockquoteExtensionOptions;
  },
});
