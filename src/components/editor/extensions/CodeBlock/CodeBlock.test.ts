import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodeBlock, type CodeBlockExtensionOptions } from './CodeBlock';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, CodeBlock],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'codeBlock');
  if (!ext) throw new Error('codeBlock extension not registered');
  return (ext.options as CodeBlockExtensionOptions).button({ editor, t }).componentProps;
}

describe('CodeBlock extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
    editor.commands.selectAll();
  });
  afterEach(() => editor.destroy());

  it('toggleCodeBlock wraps the block in <pre><code>', () => {
    editor.commands.toggleCodeBlock();
    expect(editor.isActive('codeBlock')).toBe(true);
    expect(editor.getHTML()).toContain('<pre>');
  });

  it('exposes a Pattern A button whose action toggles the block', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Code2');
    expect(props.tooltip).toBe('editor.codeBlock.tooltip');

    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});
