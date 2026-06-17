import { type BoldOptions, Bold as TiptapBold } from '@tiptap/extension-bold';
import { ActionButton } from '@/components/ui/ActionButton.tsx';

export interface BoldExtensionOptions extends BoldOptions {
  button: (context: { editor: unknown; t: (key: string) => string }) => unknown;
}

export const Bold = TiptapBold.extend<BoldExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: any) => ({
        component: ActionButton,
        componentProps: {
          action: () => (editor as any).commands.toggleBold(),
          isActive: () => (editor as any).isActive('bold') || false,
          disabled: false,
          shortcutKeys: ['Mod', 'B'],
          icon: 'Bold',
          tooltip: t('editor.bold.tooltip'),
        },
      }),
    } as unknown as BoldExtensionOptions;
  },
});
