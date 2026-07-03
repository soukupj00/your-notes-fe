import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FontSize, type FontSizeExtensionOptions } from './FontSize';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, FontSize],
    content: '<p>hi</p>',
  });
}

describe('FontSize extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setFontSize applies a font size to the selected text', () => {
    editor.commands.selectAll();
    editor.commands.setFontSize('24px');
    expect(editor.getAttributes('textStyle').fontSize).toBe('24px');
  });

  it('exposes a Pattern A button with the correct component and props', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'fontSize');
    if (!ext) throw new Error('fontSize extension not registered');
    const result = (ext.options as FontSizeExtensionOptions).button({ editor, t });
    expect(typeof result.component).toBe('function');
    expect(result.componentProps.tooltip).toBe('editor.fontSize.tooltip');
    expect(result.componentProps.editor).toBe(editor);
  });
});
