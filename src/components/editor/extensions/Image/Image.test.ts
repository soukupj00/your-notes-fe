import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImage, type ImageDeps } from './Image';

const t = ((key: string) => key) as ImageDeps['t'];

function stubDeps(): ImageDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn(),
    getAttachment: vi.fn(async () => undefined),
    cloneAttachment: vi.fn(),
    onError: vi.fn(),
    t,
  };
}

function createEditor(deps = stubDeps()) {
  return new Editor({
    extensions: [Document, Paragraph, Text, createImage(deps)],
    content: '<p></p>',
  });
}

describe('imageAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses img[data-attachment-id] and re-renders it with no src', () => {
    editor.commands.setContent('<img data-attachment-id="abc">');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertImageAttachment inserts a node carrying the id', () => {
    editor.commands.insertImageAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('exposes a Pattern A button with the image icon + tooltip', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'imageAttachment');
    const options = ext?.options as {
      button: (c: { editor: Editor; t: ImageDeps['t'] }) => { componentProps: { tooltip: string } };
    };
    const view = options.button({ editor, t });
    expect(view.componentProps.tooltip).toBe('editor.image.tooltip');
  });
});
