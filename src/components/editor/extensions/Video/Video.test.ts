import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createVideo } from './Video';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createVideo(() => deps)],
    content: '<p></p>',
  });
}

describe('videoAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses video[data-attachment-id] and re-renders with no src', () => {
    editor.commands.setContent('<video data-attachment-id="abc"></video>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertVideoAttachment inserts a node with the id', () => {
    editor.commands.insertVideoAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('button factory returns the VideoButton component with its props', () => {
    const extension = editor.extensionManager.extensions.find((e) => e.name === 'videoAttachment');
    const button = extension?.options.button({ editor, t: (k: string) => k }) as {
      component: unknown;
      componentProps: { editor: Editor; tooltip: string };
    };
    expect(button.component).toBeDefined();
    expect(button.componentProps.editor).toBe(editor);
    expect(button.componentProps.tooltip).toBe('editor.video.tooltip');
  });
});
