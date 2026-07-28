import type { HistoryOptions as TiptapHistoryOptions } from '@tiptap/extension-history';
import { History as TiptapHistory } from '@tiptap/extension-history';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

interface HistoryItem {
  command: 'undo' | 'redo';
  icon: 'Undo2' | 'Redo2';
  shortcutKeys: string[];
}

export interface HistoryOptions extends TiptapHistoryOptions {
  button: (context: ButtonContext) => ButtonView[];
}

const HISTORY_ITEMS: HistoryItem[] = [
  { command: 'undo', icon: 'Undo2', shortcutKeys: ['Mod', 'Z'] },
  { command: 'redo', icon: 'Redo2', shortcutKeys: ['Mod', 'Shift', 'Z'] },
];

export const History = TiptapHistory.extend<HistoryOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      depth: 100,
      newGroupDelay: 500,
      button: ({ editor, t }: ButtonContext) =>
        HISTORY_ITEMS.map(({ command, icon, shortcutKeys }) => ({
          component: ActionButton,
          componentProps: {
            action: () => {
              const chain = editor.chain().focus();
              if (command === 'undo') chain.undo().run();
              else chain.redo().run();
            },
            shortcutKeys,
            disabled: command === 'undo' ? !editor.can().undo() : !editor.can().redo(),
            icon,
            tooltip: t(`editor.${command}`),
          },
        })),
    } as unknown as HistoryOptions;
  },
});
