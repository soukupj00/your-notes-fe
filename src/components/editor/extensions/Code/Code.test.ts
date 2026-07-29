import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Code, type CodeExtensionOptions } from './Code';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Code],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'code');
  if (!ext) throw new Error('code extension not registered');
  return (ext.options as CodeExtensionOptions).button({ editor, t }).componentProps;
}

describe('Code extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleCode marks the selection as inline code', () => {
    editor.commands.toggleCode();
    expect(editor.isActive('code')).toBe(true);
    expect(editor.getHTML()).toContain('<code>');
  });

  it('exposes a Pattern A button whose action toggles the mark', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Code');
    expect(props.tooltip).toBe('editor.code.tooltip');

    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
