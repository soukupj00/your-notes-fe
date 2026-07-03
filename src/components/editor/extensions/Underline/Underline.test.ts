import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Underline, type UnderlineExtensionOptions } from './Underline';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Underline],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'underline');
  if (!ext) throw new Error('underline extension not registered');
  return (ext.options as UnderlineExtensionOptions).button({ editor, t }).componentProps;
}

describe('Underline extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleUnderline turns the selection underlined', () => {
    expect(editor.isActive('underline')).toBe(false);
    editor.commands.toggleUnderline();
    expect(editor.isActive('underline')).toBe(true);
    expect(editor.getHTML()).toContain('<u>');
  });

  it('exposes a Pattern A button whose action toggles underline', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Underline');
    expect(props.tooltip).toBe('editor.underline.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', 'U']);
    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
