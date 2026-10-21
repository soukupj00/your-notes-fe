import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { Typography } from './Typography';

let editor: Editor;

afterEach(() => editor.destroy());

/** Key by key, through the input rules, as a user types. */
function type(text: string) {
  editor = new Editor({ extensions: [Document, Paragraph, Text, Typography], content: '<p></p>' });
  editor.commands.focus();
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
    );
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
  }
  return editor.getText();
}

describe('Typography', () => {
  it.each([
    ['inline', '$$x^2 -> y != 2x3'],
    ['block', '$$$a -- b ^3'],
  ])('leaves %s LaTeX that is still being typed alone', (_kind, latex) => {
    expect(type(latex)).toBe(latex);
  });

  it.each([
    ['in prose', 'x^2', 'x²'],
    ['after a closed formula', '$$a$$ x^2', '$$a$$ x²'],
  ])('still rewrites %s', (_where, typed, expected) => {
    expect(type(typed)).toBe(expected);
  });
});
