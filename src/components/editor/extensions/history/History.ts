import { History as TiptapHistory } from '@tiptap/extension-history';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';

interface HistoryItem {
  command: 'undo' | 'redo';
  icon: 'Undo2' | 'Redo2';
  shortcutKeys: string[];
}

const HISTORY_ITEMS: HistoryItem[] = [
  { command: 'undo', icon: 'Undo2', shortcutKeys: ['Mod', 'Z'] },
  { command: 'redo', icon: 'Redo2', shortcutKeys: ['Mod', 'Shift', 'Z'] },
];

export const History = withButton(
  TiptapHistory,
  ({ editor, t }) =>
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
  { depth: 100, newGroupDelay: 500 }
);
