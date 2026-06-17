import type { HistoryOptions as TiptapHistoryOptions } from '@tiptap/extension-history';
import { History as TiptapHistory } from '@tiptap/extension-history';
import HistoryActionButton from '@/components/editor/extensions/history/HistoryActionButton.tsx';

export interface HistoryOptions extends TiptapHistoryOptions {}
const historyOptions: ['undo', 'redo'] = ['undo', 'redo'];

export const History = TiptapHistory.extend<HistoryOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      depth: 100,
      newGroupDelay: 500,
      button: ({ editor, t }: any) => {
        return historyOptions.map((item) => ({
          component: HistoryActionButton,
          componentProps: {
            action: () => {
              if (item === 'undo') {
                editor.chain().focus().undo().run();
              } else {
                editor.chain().focus().redo().run();
              }
            },
            shortcutKeys: item === 'undo' ? ['Mod', 'Z'] : ['Mod', 'Shift', 'Z'],
            disabled: item === 'undo' ? !editor.can().undo() : !editor.can().redo(),
            isActive: () => (item === 'undo' ? !editor.can().undo() : !editor.can().redo()),
            tooltip: t(`editor.${item}`),
          },
        }));
      },
    };
  },
});
