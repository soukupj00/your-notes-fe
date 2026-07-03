import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ColorPreview, clearColorPreview, colorPreviewKey, previewColor } from './color-preview';

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, ColorPreview],
    content: '<p>hello</p>',
  });
}

describe('ColorPreview extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('starts with no preview decoration', () => {
    const set = colorPreviewKey.getState(editor.state);
    expect(set?.find().length).toBe(0);
  });

  it('previewColor adds an inline decoration over the range without changing the doc', () => {
    const before = editor.getHTML();
    previewColor(editor, { from: 1, to: 4, style: 'color: #ef4444' });

    const decorations = colorPreviewKey.getState(editor.state)?.find() ?? [];
    expect(decorations).toHaveLength(1);
    expect(decorations[0].from).toBe(1);
    expect(decorations[0].to).toBe(4);
    // Preview must never mutate the document (no committed mark / undo entry).
    expect(editor.getHTML()).toBe(before);
  });

  it('clearColorPreview removes the decoration', () => {
    previewColor(editor, { from: 1, to: 4, style: 'color: #ef4444' });
    expect(colorPreviewKey.getState(editor.state)?.find()).toHaveLength(1);

    clearColorPreview(editor);
    expect(colorPreviewKey.getState(editor.state)?.find()).toHaveLength(0);
  });
});
