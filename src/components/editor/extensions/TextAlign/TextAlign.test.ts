import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TextAlign, type TextAlignExtensionOptions } from './TextAlign';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, TextAlign],
    content: '<p>hello</p>',
  });
}

function getButtons(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'textAlign');
  if (!ext) throw new Error('textAlign extension not registered');
  return (ext.options as TextAlignExtensionOptions).button({ editor, t });
}

describe('TextAlign extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('setTextAlign applies the alignment to the paragraph', () => {
    editor.commands.setTextAlign('center');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
    expect(editor.getHTML()).toContain('text-align: center');
  });

  it('contributes one button per alignment, left to right', () => {
    const buttons = getButtons(editor);
    expect(buttons.map((b) => b.componentProps.icon)).toEqual([
      'AlignLeft',
      'AlignCenter',
      'AlignRight',
    ]);
  });

  it('each button toggles its own alignment', () => {
    const [, center] = getButtons(editor);
    expect(center.componentProps.isActive?.()).toBe(false);

    center.componentProps.action?.();
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
  });
});
