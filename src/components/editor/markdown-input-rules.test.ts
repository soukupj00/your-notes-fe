import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { BulletList, Code, CodeBlock, HorizontalRule, OrderedList } from './extensions/formatting';
import { Heading } from './extensions/Heading';
import { ListItem } from './extensions/ListItem';
import { TaskList } from './extensions/TaskList';

/**
 * Not re-testing TipTap: proves the markdown shorthands survive our composition, since a
 * wrapper that forgets `...this.parent?.()` silently drops every input rule.
 */
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
      TaskList,
      TaskItem,
      Code,
      CodeBlock,
      HorizontalRule,
    ],
    content: '<p></p>',
  });
}

let editor: Editor;
afterEach(() => editor?.destroy());

/**
 * Input rules only run through ProseMirror's `handleTextInput`, which neither
 * `insertContent` nor `setContent` goes through - type the prefix, then feed the
 * triggering character the way the view would.
 */
function type(prefix: string, trigger: string) {
  editor.commands.focus();
  editor.commands.insertContent(prefix);
  const from = editor.state.selection.from;
  editor.view.someProp('handleTextInput', (f) =>
    f(editor.view, from, from, trigger, () => editor.view.state.tr)
  );
}

describe('markdown input rules', () => {
  it('turns "# " into a heading', () => {
    editor = createEditor();
    type('#', ' ');
    expect(editor.getHTML()).toContain('<h1>');
  });

  it('turns "- " into a bulleted list', () => {
    editor = createEditor();
    type('-', ' ');
    expect(editor.getHTML()).toContain('<ul>');
  });

  it('turns "1. " into a numbered list', () => {
    editor = createEditor();
    type('1.', ' ');
    expect(editor.getHTML()).toContain('<ol>');
  });

  it('turns "[] " into a checklist', () => {
    editor = createEditor();
    type('[]', ' ');
    expect(editor.getHTML()).toContain('data-type="taskList"');
  });

  // The code-block rule wants a whitespace terminator after the fence, so the
  // trigger is the space, not the third backtick.
  it('turns "``` " into a code block', () => {
    editor = createEditor();
    type('```', ' ');
    expect(editor.getHTML()).toContain('<pre>');
  });

  it('turns "---" into a divider', () => {
    editor = createEditor();
    type('--', '-');
    expect(editor.getHTML()).toContain('<hr');
  });

  it('turns backticked text into inline code', () => {
    editor = createEditor();
    type('`code', '`');
    expect(editor.getHTML()).toContain('<code>');
  });
});
