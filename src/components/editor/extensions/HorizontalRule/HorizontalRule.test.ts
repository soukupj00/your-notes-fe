import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HorizontalRule, type HorizontalRuleExtensionOptions } from './HorizontalRule';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, HorizontalRule],
    content: '<p>hello</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'horizontalRule');
  if (!ext) throw new Error('horizontalRule extension not registered');
  return (ext.options as HorizontalRuleExtensionOptions).button({ editor, t }).componentProps;
}

describe('HorizontalRule extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setHorizontalRule inserts a rule', () => {
    editor.commands.setHorizontalRule();
    expect(editor.getHTML()).toContain('<hr');
  });

  it('exposes a Pattern A button that inserts, with no active state', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Minus');
    expect(props.tooltip).toBe('editor.horizontalRule.tooltip');
    // A rule is an insert, not a toggle - there is no "cursor inside a rule".
    expect(props.isActive).toBeUndefined();
    expect(props.toggle).toBeUndefined();

    props.action?.();
    expect(editor.getHTML()).toContain('<hr');
  });
});
