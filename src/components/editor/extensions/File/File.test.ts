import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createFile } from './File';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createFile(() => deps)],
    content: '<p></p>',
  });
}

describe('fileAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses a[data-attachment-id] and re-renders with no href', () => {
    editor.commands.setContent('<a data-attachment-id="abc">x</a>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('href=');
  });

  it('insertFileAttachment inserts a node with the id', () => {
    editor.commands.insertFileAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('button factory returns the FileButton component with its props', () => {
    const extension = editor.extensionManager.extensions.find((e) => e.name === 'fileAttachment');
    const button = extension?.options.button({ editor, t: (k: string) => k }) as {
      component: unknown;
      componentProps: { editor: Editor; tooltip: string };
    };
    expect(button.component).toBeDefined();
    expect(button.componentProps.editor).toBe(editor);
    expect(button.componentProps.tooltip).toBe('editor.file.tooltip');
  });
});
