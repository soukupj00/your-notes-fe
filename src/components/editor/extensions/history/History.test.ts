import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { HistoryOptions } from './History';
import { History } from './History';

const t = (key: string) => key;
const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe('History extension', () => {
  it('exposes canonical, named undo and redo action buttons', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, History] });
    editors.push(editor);
    const extension = editor.extensionManager.extensions.find((item) => item.name === 'undoRedo');
    if (!extension) throw new Error('history extension not registered');

    const buttons = (extension.options as HistoryOptions).button({ editor, t });

    expect(buttons.map((button) => button.component)).toEqual([ActionButton, ActionButton]);
    expect(buttons.map((button) => button.componentProps.icon)).toEqual(['Undo2', 'Redo2']);
    expect(buttons.map((button) => button.componentProps.tooltip)).toEqual([
      'editor.undo',
      'editor.redo',
    ]);
  });
});
