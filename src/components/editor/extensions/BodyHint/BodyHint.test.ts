import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { createBodyHint } from './BodyHint';

let editor: Editor;

afterEach(() => editor.destroy());

function mount(content: string, editable = true) {
  editor = new Editor({
    extensions: [
      Document,
      Paragraph,
      Heading,
      TaskList,
      TaskItem,
      Text,
      createBodyHint((key) => key),
    ],
    content,
    editable,
  });
  return editor.view.dom;
}

describe('BodyHint', () => {
  it('marks the empty paragraph for the stylesheet and gives the textbox the same hint', () => {
    const body = mount('');

    const paragraph = body.querySelector('p.is-editor-empty');
    expect(paragraph?.getAttribute('data-placeholder')).toBe('editor.placeholder');
    expect(body.getAttribute('aria-placeholder')).toBe('editor.placeholder');
    expect(body.getAttribute('role')).toBe('textbox');
  });

  it('drops both on the first character and returns them when the body is emptied', () => {
    const body = mount('');

    editor.commands.insertContent('a');
    expect(body.querySelector('.is-editor-empty')).toBeNull();
    expect(body.hasAttribute('aria-placeholder')).toBe(false);

    editor.commands.clearContent();
    expect(body.querySelector('p.is-editor-empty')).not.toBeNull();
    expect(body.getAttribute('aria-placeholder')).toBe('editor.placeholder');
  });

  it.each([
    ['a body with text', '<p>kept</p>', true],
    ['a read-only body', '', false],
    ['blank lines', '<p></p><p></p>', true],
    ['an empty heading', '<h1></h1>', true],
    [
      "a new Checklist's first row",
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      true,
    ],
  ])('gives the textbox no hint on %s', (_case, content, editable) => {
    const body = mount(content, editable);

    expect(body.hasAttribute('aria-placeholder')).toBe(false);
  });
});
