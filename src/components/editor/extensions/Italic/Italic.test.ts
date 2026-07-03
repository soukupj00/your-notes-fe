import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Italic, type ItalicExtensionOptions } from './Italic';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Italic],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'italic');
  if (!ext) throw new Error('italic extension not registered');
  return (ext.options as ItalicExtensionOptions).button({ editor, t }).componentProps;
}

describe('Italic extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleItalic turns the selection italic', () => {
    expect(editor.isActive('italic')).toBe(false);
    editor.commands.toggleItalic();
    expect(editor.isActive('italic')).toBe(true);
    expect(editor.getHTML()).toContain('<em>');
  });

  it('exposes a Pattern A button whose action toggles italic', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Italic');
    expect(props.tooltip).toBe('editor.italic.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', 'I']);
    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
