import { type BulletListOptions, BulletList as TiptapBulletList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface BulletListExtensionOptions extends BulletListOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const BulletList = TiptapBulletList.extend<BulletListExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleBulletList(),
          isActive: () => editor.isActive('bulletList'),
          shortcutKeys: ['Mod', 'Shift', '8'],
          icon: 'List',
          tooltip: t('editor.bulletList.tooltip'),
        },
      }),
    } as unknown as BulletListExtensionOptions;
  },
});
