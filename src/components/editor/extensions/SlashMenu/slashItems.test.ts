import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { Blockquote } from '../Blockquote';
import { BulletList } from '../BulletList';
import { CodeBlock } from '../CodeBlock';
import { Heading } from '../Heading';
import { HorizontalRule } from '../HorizontalRule';
import { ListItem } from '../ListItem';
import { OrderedList } from '../OrderedList';
import { filterSlashItems, SLASH_ITEMS } from './slashItems';

const t = (key: string) => key.replace('editor.slash.', '');

function createEditor() {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading,
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      CodeBlock,
      HorizontalRule,
    ],
    content: '<p></p>',
  });
}

function item(key: string) {
  const found = SLASH_ITEMS.find((i) => i.key === key);
  if (!found) throw new Error(`no slash item ${key}`);
  return found;
}

describe('filterSlashItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterSlashItems('', t)).toHaveLength(SLASH_ITEMS.length);
  });

  it('matches on the visible label', () => {
    const keys = filterSlashItems('divider', t).map((i) => i.key);
    expect(keys).toContain('horizontalRule');
  });

  // A menu that only matched our own wording would make the user guess it.
  it('matches on keywords the label does not contain', () => {
    expect(filterSlashItems('todo', t).map((i) => i.key)).toContain('taskList');
    expect(filterSlashItems('bullet', t).map((i) => i.key)).toContain('bulletList');
    expect(filterSlashItems('sketch', t).map((i) => i.key)).toContain('drawing');
  });

  it('narrows to nothing for a query that matches no item', () => {
    expect(filterSlashItems('zzzzz', t)).toEqual([]);
  });
});

describe('slash item commands', () => {
  let editor: Editor;
  let deps: AttachmentDeps;

  beforeEach(() => {
    editor = createEditor();
    deps = { openExcalidraw: vi.fn(), t } as unknown as AttachmentDeps;
  });
  afterEach(() => editor.destroy());

  /** Stand in for what Suggestion passes: the range covering the typed `/query`. */
  function runWithTypedQuery(key: string, typed: string) {
    editor.commands.focus();
    editor.commands.insertContent(typed);
    const to = editor.state.selection.from;
    item(key).run({ editor, range: { from: to - typed.length, to }, deps });
  }

  it.each([
    ['heading1', '<h1>'],
    ['bulletList', '<ul>'],
    ['orderedList', '<ol>'],
    ['blockquote', '<blockquote>'],
    ['codeBlock', '<pre>'],
    ['horizontalRule', '<hr'],
  ])('%s inserts its block', (key, expected) => {
    runWithTypedQuery(key, '/x');
    expect(editor.getHTML()).toContain(expected);
  });

  // Every item consumes the range, or the query it was chosen from stays behind.
  it('removes the typed query rather than leaving it in the document', () => {
    runWithTypedQuery('bulletList', '/bullet');
    expect(editor.getText()).not.toContain('/bullet');
  });

  it('opens the drawing surface rather than inserting a node itself', () => {
    runWithTypedQuery('drawing', '/draw');
    expect(deps.openExcalidraw).toHaveBeenCalledOnce();
  });
});
