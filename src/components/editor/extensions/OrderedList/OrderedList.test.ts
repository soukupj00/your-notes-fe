import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { BulletList } from '../BulletList';
import { OrderedList, type OrderedListExtensionOptions } from './OrderedList';

const t = (key: string) => key;

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'orderedList');
  if (!ext) throw new Error('orderedList not registered');
  return (ext.options as OrderedListExtensionOptions).button({ editor, t }).componentProps;
}

describe('OrderedList extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor.destroy();
  });

  describe('toggle behavior', () => {
    it('toggleOrderedList wraps content in <ol> and marks orderedList as active', () => {
      editor = new Editor({
        extensions: [Document, Paragraph, Text, OrderedList, ListItem],
        content: '<p>item</p>',
      });

      editor.commands.selectAll();
      editor.commands.toggleOrderedList();

      expect(editor.isActive('orderedList')).toBe(true);
      expect(editor.getHTML()).toContain('<ol>');
    });
  });

  describe('button factory', () => {
    it('returns correct Pattern A props', () => {
      editor = new Editor({
        extensions: [Document, Paragraph, Text, OrderedList, ListItem],
        content: '<p>item</p>',
      });

      const props = getButtonProps(editor);
      expect(props.icon).toBe('ListOrdered');
      expect(props.tooltip).toBe('editor.orderedList.tooltip');
      expect(props.shortcutKeys).toEqual(['Mod', 'Shift', '7']);
    });
  });

  describe('switch behavior', () => {
    it('switching from bulletList to orderedList works directly without toggling off first', () => {
      editor = new Editor({
        extensions: [Document, Paragraph, Text, BulletList, OrderedList, ListItem],
        content: '<p>item</p>',
      });

      editor.commands.selectAll();
      editor.commands.toggleBulletList();
      expect(editor.isActive('bulletList')).toBe(true);

      const props = getButtonProps(editor);
      props.action?.();

      expect(editor.isActive('orderedList')).toBe(true);
      expect(editor.isActive('bulletList')).toBe(false);
    });
  });
});
