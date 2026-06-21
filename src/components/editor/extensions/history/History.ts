import type { HistoryOptions as TiptapHistoryOptions } from '@tiptap/extension-history';
import { History as TiptapHistory } from '@tiptap/extension-history';
import type React from 'react';
import HistoryActionButton from '@/components/editor/extensions/history/HistoryActionButton.tsx';
import type { ButtonContext } from '../button-types';

type HistoryItem = 'undo' | 'redo';

interface HistoryButtonView {
  component: typeof HistoryActionButton;
  componentProps: React.ComponentProps<typeof HistoryActionButton>;
}

export interface HistoryOptions extends TiptapHistoryOptions {
  button: (context: ButtonContext) => HistoryButtonView[];
}

const historyItems: HistoryItem[] = ['undo', 'redo'];

export const History = TiptapHistory.extend<HistoryOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      depth: 100,
      newGroupDelay: 500,
      button: ({ editor, t }: ButtonContext) =>
        historyItems.map((item) => ({
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
            isActive: item === 'undo' ? !editor.can().undo() : !editor.can().redo(),
            tooltip: t(`editor.${item}`),
          },
        })),
    } as unknown as HistoryOptions;
  },
});
