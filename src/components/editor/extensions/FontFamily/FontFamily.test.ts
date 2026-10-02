import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FontFamily, type FontFamilyExtensionOptions } from './FontFamily';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, FontFamily],
    content: '<p>hi</p>',
  });
}

describe('FontFamily extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setFontFamily applies a font family to the selected text', () => {
    editor.commands.selectAll();
    editor.commands.setFontFamily('ui-serif, Georgia, serif');
    expect(editor.getAttributes('textStyle').fontFamily).toBe('ui-serif, Georgia, serif');
  });

  it('exposes a Pattern A button with the correct component and props', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'fontFamily');
    if (!ext) throw new Error('fontFamily extension not registered');
    const result = (ext.options as FontFamilyExtensionOptions).button({ editor, t });
    expect(typeof result.component).toBe('function');
    expect(result.componentProps.tooltip).toBe('editor.fontFamily.tooltip');
    expect(result.componentProps.editor).toBe(editor);
    expect(result.componentProps.variant).toBe('fontFamily');
  });
});
