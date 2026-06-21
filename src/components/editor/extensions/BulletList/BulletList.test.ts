import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BulletList, type BulletListExtensionOptions } from './BulletList';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, ListItem, BulletList],
    content: '<p>item</p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'bulletList');
  if (!ext) throw new Error('bulletList not registered');
  return (ext.options as BulletListExtensionOptions).button({ editor, t }).componentProps;
}

describe('BulletList extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('toggle behavior', () => {
    it('toggleBulletList wraps content in <ul> and marks bulletList as active', () => {
      editor.commands.selectAll();
      editor.commands.toggleBulletList();

      expect(editor.isActive('bulletList')).toBe(true);
      expect(editor.getHTML()).toContain('<ul>');
    });
  });

  describe('button factory', () => {
    it('returns icon === "List"', () => {
      const props = getButtonProps(editor);
      expect(props.icon).toBe('List');
    });

    it('returns correct tooltip key', () => {
      const props = getButtonProps(editor);
      expect(props.tooltip).toBe('editor.bulletList.tooltip');
    });

    it('returns correct shortcutKeys', () => {
      const props = getButtonProps(editor);
      expect(props.shortcutKeys).toEqual(['Mod', 'Shift', '8']);
    });

    it('action() toggles bulletList: isActive() goes from false to true', () => {
      const props = getButtonProps(editor);

      expect(props.isActive?.()).toBe(false);

      editor.commands.selectAll();
      props.action?.();

      expect(props.isActive?.()).toBe(true);
    });
  });
});
