import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Bold, type BoldExtensionOptions } from './Bold';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Bold],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'bold');
  if (!ext) throw new Error('bold extension not registered');
  return (ext.options as BoldExtensionOptions).button({ editor, t }).componentProps;
}

describe('Bold extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleBold turns the selection bold', () => {
    expect(editor.isActive('bold')).toBe(false);
    editor.commands.toggleBold();
    expect(editor.isActive('bold')).toBe(true);
    expect(editor.getHTML()).toContain('<strong>');
  });

  it('exposes a Pattern A button whose action toggles bold', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Bold');
    expect(props.tooltip).toBe('editor.bold.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', 'B']);

    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
