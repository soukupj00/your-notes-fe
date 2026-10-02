import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Bold } from '../formatting';
import { Clear, type ClearExtensionOptions } from './Clear';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Bold, Clear],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'clear');
  if (!ext) throw new Error('clear extension not registered');
  return (ext.options as ClearExtensionOptions).button({ editor, t }).componentProps;
}

describe('Clear extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('clears bold formatting from the selection', () => {
    editor.commands.toggleBold();
    expect(editor.getHTML()).toContain('<strong>');
    const props = getButtonProps(editor);
    props.action?.();
    expect(editor.getHTML()).not.toContain('<strong>');
  });

  it('exposes a Pattern A button with the correct props', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('RemoveFormatting');
    expect(props.tooltip).toBe('editor.clearFormatting.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', '\\']);
  });
});
