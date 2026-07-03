import { type StrikeOptions, Strike as TiptapStrike } from '@tiptap/extension-strike';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface StrikeExtensionOptions extends StrikeOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const Strike = TiptapStrike.extend<StrikeExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleStrike(),
          isActive: () => editor.isActive('strike'),
          shortcutKeys: ['Mod', 'Shift', 'S'],
          icon: 'Strikethrough',
          tooltip: t('editor.strike.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as StrikeExtensionOptions;
  },
});
