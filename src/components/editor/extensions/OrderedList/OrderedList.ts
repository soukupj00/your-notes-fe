import { type OrderedListOptions, OrderedList as TiptapOrderedList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';
import { toggleWholeList } from '../list-toggle';

export interface OrderedListExtensionOptions extends OrderedListOptions {
  button: (context: ButtonContext) => ButtonView;
}

export const OrderedList = TiptapOrderedList.extend<OrderedListExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => toggleWholeList(editor, (chain) => chain.toggleOrderedList()),
          isActive: () => editor.isActive('orderedList'),
          shortcutKeys: ['Mod', 'Shift', '7'],
          icon: 'ListOrdered',
          tooltip: t('editor.orderedList.tooltip'),
          toggle: true,
        },
      }),
    } as unknown as OrderedListExtensionOptions;
  },
});
