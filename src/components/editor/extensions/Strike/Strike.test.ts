import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Strike, type StrikeExtensionOptions } from './Strike';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Strike],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'strike');
  if (!ext) throw new Error('strike extension not registered');
  return (ext.options as StrikeExtensionOptions).button({ editor, t }).componentProps;
}

describe('Strike extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleStrike turns the selection strikethrough', () => {
    expect(editor.isActive('strike')).toBe(false);
    editor.commands.toggleStrike();
    expect(editor.isActive('strike')).toBe(true);
    expect(editor.getHTML()).toContain('<s>');
  });

  it('exposes a Pattern A button whose action toggles strike', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Strikethrough');
    expect(props.tooltip).toBe('editor.strike.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', 'Shift', 'S']);
    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
