import { UndoRedo } from '@tiptap/extensions';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';
import { withoutKeys } from '../withoutKeys';

interface HistoryItem {
  command: 'undo' | 'redo';
  icon: 'Undo2' | 'Redo2';
}

const HISTORY_ITEMS: HistoryItem[] = [
  { command: 'undo', icon: 'Undo2' },
  { command: 'redo', icon: 'Redo2' },
];

export const History = withButton(
  withoutKeys(UndoRedo, ['Mod-z', 'Shift-Mod-z', 'Mod-y', 'Mod-я', 'Shift-Mod-я']),
  ({ editor, t }) =>
    HISTORY_ITEMS.map(({ command, icon }) => ({
      component: ActionButton,
      componentProps: {
        action: () => {
          const chain = editor.chain().focus();
          if (command === 'undo') chain.undo().run();
          else chain.redo().run();
        },
        disabled: command === 'undo' ? !editor.can().undo() : !editor.can().redo(),
        icon,
        tooltip: t(`editor.${command}`),
      },
    }))
);
