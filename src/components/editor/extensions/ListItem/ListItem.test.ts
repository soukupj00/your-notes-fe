import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BulletList } from '../BulletList';
import { ListItem } from './ListItem';

describe('ListItem extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Paragraph, Text, BulletList, ListItem],
      content: '<p>item</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('toggleBulletList produces <li> elements', () => {
    editor.commands.selectAll();
    editor.commands.toggleBulletList();
    expect(editor.getHTML()).toContain('<li>');
  });
});
