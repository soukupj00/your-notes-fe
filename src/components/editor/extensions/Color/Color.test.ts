import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Color, type ColorExtensionOptions } from './Color';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, Color],
    content: '<p>hi</p>',
  });
}

describe('Color extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setColor applies a color to the selected text', () => {
    editor.commands.selectAll();
    editor.commands.setColor('#ef4444');
    expect(editor.getAttributes('textStyle').color).toBe('#ef4444');
  });

  it('exposes a Pattern A button with the correct component and props', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'color');
    if (!ext) throw new Error('color extension not registered');
    const result = (ext.options as ColorExtensionOptions).button({ editor, t });
    expect(typeof result.component).toBe('function');
    expect(result.componentProps.tooltip).toBe('editor.textColor.tooltip');
    expect(result.componentProps.editor).toBe(editor);
  });
});
