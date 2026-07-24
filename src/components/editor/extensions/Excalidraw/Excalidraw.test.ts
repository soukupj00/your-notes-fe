import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createExcalidraw } from './Excalidraw';

// The node factory pulls in the NodeView module; mock the heavy canvas lib so
// this headless test never touches it.
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createExcalidraw(() => deps)],
    content: '<p></p>',
  });
}

describe('excalidrawAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses excalidraw-drawing[data-attachment-id] and re-renders with no payload', () => {
    editor.commands.setContent(
      '<excalidraw-drawing data-attachment-id="abc"></excalidraw-drawing>'
    );
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).toContain('excalidraw-drawing');
  });

  it('insertExcalidrawAttachment inserts a node with the id', () => {
    editor.commands.insertExcalidrawAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('exposes a Pattern A button with the drawing tooltip', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'excalidrawAttachment');
    const button = ext?.options.button({ editor, t: (k: string) => k }) as {
      componentProps: { tooltip: string };
    };
    expect(button.componentProps.tooltip).toBe('editor.excalidraw.tooltip');
  });
});
