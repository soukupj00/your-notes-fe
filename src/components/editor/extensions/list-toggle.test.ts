import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BulletList } from './BulletList';
import type { ButtonView } from './button-types';
import { ListItem } from './ListItem';
import { OrderedList } from './OrderedList';
import { TaskList } from './TaskList';

const t = (key: string) => key;

// Surrounding paragraphs before/after the target list guard against the range
// spilling into neighbouring blocks when the list is not the first node.
const CONTENT =
  '<p>before</p>' +
  '<ul><li><p>one</p></li><li><p>two</p></li><li><p>three</p></li></ul>' +
  '<p>after</p>';

function createEditor(content = CONTENT) {
  return new Editor({
    extensions: [Document, Paragraph, Text, BulletList, OrderedList, ListItem, TaskList, TaskItem],
    content,
  });
}

function clickButton(editor: Editor, name: string) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === name);
  if (!ext) throw new Error(`${name} not registered`);
  const view = (
    ext.options as { button: (ctx: { editor: Editor; t: typeof t }) => ButtonView }
  ).button({ editor, t });
  view.componentProps.action?.();
}

function placeCursorIn(editor: Editor, word: string) {
  let pos = 0;
  editor.state.doc.descendants((node, p) => {
    if (node.isText && node.text === word) pos = p + 1;
  });
  editor.commands.setTextSelection(pos);
}

describe('whole-list toggling (collapsed cursor)', () => {
  let editor: Editor;
  afterEach(() => editor.destroy());
  beforeEach(() => {
    editor = createEditor();
  });

  it('converts the entire bullet list to a task list, not just the current item', () => {
    placeCursorIn(editor, 'two');
    clickButton(editor, 'taskList');
    const html = editor.getHTML();
    expect((html.match(/data-type="taskItem"/g) || []).length).toBe(3);
    // no leftover plain <ul>/<li> fragments from a partial conversion
    expect(html).not.toMatch(/<li(?![^>]*taskItem)/);
    expect(html).toContain('<p>before</p>');
    expect(html).toContain('<p>after</p>');
  });

  it('converts an entire task list back to a bullet list', () => {
    placeCursorIn(editor, 'two');
    clickButton(editor, 'taskList');
    placeCursorIn(editor, 'three');
    clickButton(editor, 'bulletList');
    const html = editor.getHTML();
    expect(html).not.toContain('taskItem');
    expect((html.match(/<li>/g) || []).length).toBe(3);
    expect(html).toContain('<p>before</p>');
    expect(html).toContain('<p>after</p>');
  });

  it('still switches bullet to ordered for the whole list', () => {
    placeCursorIn(editor, 'two');
    clickButton(editor, 'orderedList');
    const html = editor.getHTML();
    expect(html).toContain('<ol>');
    expect(html).not.toContain('<ul>');
    expect((html.match(/<li>/g) || []).length).toBe(3);
    expect(html).toContain('<p>before</p>');
    expect(html).toContain('<p>after</p>');
  });

  it('respects an explicit multi-block selection instead of expanding', () => {
    // Select only the first two list items; the third should remain a bullet item.
    let from = 0;
    let to = 0;
    editor.state.doc.descendants((node, p) => {
      if (node.isText && node.text === 'one') from = p;
      if (node.isText && node.text === 'two') to = p + node.nodeSize;
    });
    editor.commands.setTextSelection({ from, to });
    clickButton(editor, 'taskList');
    const html = editor.getHTML();
    expect((html.match(/data-type="taskItem"/g) || []).length).toBe(2);
    expect(html).toContain('<p>before</p>');
    expect(html).toContain('<p>after</p>');
  });
});
