import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Blockquote, type BlockquoteExtensionOptions } from './Blockquote';

const t = (key: string) => key;

function createEditor(content = '<p>quote me</p>') {
  return new Editor({
    extensions: [Document, Paragraph, Text, Blockquote],
    content,
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'blockquote');
  if (!ext) throw new Error('blockquote not registered');
  return (ext.options as BlockquoteExtensionOptions).button({ editor, t }).componentProps;
}

describe('Blockquote extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor.destroy();
  });

  describe('toggle behavior', () => {
    beforeEach(() => {
      editor = createEditor();
    });

    it('toggleBlockquote wraps content in <blockquote> and marks blockquote as active', () => {
      editor.commands.selectAll();
      editor.commands.toggleBlockquote();

      expect(editor.isActive('blockquote')).toBe(true);
      expect(editor.getHTML()).toContain('<blockquote>');
    });
  });

  describe('button factory (Pattern A)', () => {
    beforeEach(() => {
      editor = createEditor();
    });

    it('returns icon === "Quote"', () => {
      const props = getButtonProps(editor);
      expect(props.icon).toBe('Quote');
    });

    it('returns correct tooltip key', () => {
      const props = getButtonProps(editor);
      expect(props.tooltip).toBe('editor.blockquote.tooltip');
    });

    it('returns correct shortcutKeys', () => {
      const props = getButtonProps(editor);
      expect(props.shortcutKeys).toEqual(['Mod', 'Shift', 'B']);
    });

    it('action() toggles blockquote: isActive() goes from false to true', () => {
      const props = getButtonProps(editor);

      expect(props.isActive?.()).toBe(false);

      editor.commands.selectAll();
      props.action?.();

      expect(props.isActive?.()).toBe(true);
    });
  });

  describe('markdown input rule', () => {
    it('typing "> " at the start of a paragraph converts it to a blockquote', () => {
      editor = createEditor('<p></p>');

      editor.commands.focus();
      editor.commands.insertContent('>');
      const from = editor.state.selection.from;
      editor.view.someProp('handleTextInput', (f) =>
        f(editor.view, from, from, ' ', () => editor.view.state.tr)
      );

      expect(editor.getHTML()).toContain('<blockquote>');
    });
  });
});
