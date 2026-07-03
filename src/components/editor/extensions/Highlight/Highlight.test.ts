import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Highlight, type HighlightExtensionOptions } from './Highlight';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, Highlight],
    content: '<p>hi</p>',
  });
}

describe('Highlight extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setBackgroundColor applies a background color to the selected text', () => {
    editor.commands.selectAll();
    editor.commands.setBackgroundColor('#fef08a');
    expect(editor.getAttributes('textStyle').backgroundColor).toBe('#fef08a');
  });

  it('exposes a Pattern A button with the correct component and props', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'backgroundColor');
    if (!ext) throw new Error('backgroundColor extension not registered');
    const result = (ext.options as HighlightExtensionOptions).button({ editor, t });
    expect(typeof result.component).toBe('function');
    expect(result.componentProps.tooltip).toBe('editor.highlight.tooltip');
    expect(result.componentProps.editor).toBe(editor);
  });
});
