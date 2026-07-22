import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createAudio } from './Audio';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createAudio(() => deps)],
    content: '<p></p>',
  });
}

describe('audioAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses audio[data-attachment-id] and re-renders with no src', () => {
    editor.commands.setContent('<audio data-attachment-id="abc"></audio>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertAudioAttachment inserts a node with the id', () => {
    editor.commands.insertAudioAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });
});
