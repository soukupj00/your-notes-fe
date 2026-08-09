import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLink, type LinkExtensionOptions } from './Link';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createLink(t)],
    content: '<p>tiptap.dev</p>',
  });
}

function getExtension(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'link');
  if (!ext) throw new Error('link extension not registered');
  return ext;
}

describe('Link extension', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('setLink marks the selection and unsetLink clears it', () => {
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://example.com' });
    expect(editor.isActive('link')).toBe(true);
    expect(editor.getHTML()).toContain('href="https://example.com"');

    editor.commands.unsetLink();
    expect(editor.isActive('link')).toBe(false);
  });

  // Clicking a link inside the editor must place the cursor, not navigate away
  // from a note that may not be saved yet.
  it('does not open links on click while editing', () => {
    expect(getExtension(editor).options.openOnClick).toBe(false);
  });

  it('keeps autolink and link-on-paste on, defaulting to https', () => {
    const { autolink, linkOnPaste, defaultProtocol } = getExtension(editor).options;
    expect(autolink).toBe(true);
    expect(linkOnPaste).toBe(true);
    expect(defaultProtocol).toBe('https');
  });

  it('exposes a Pattern A button carrying the editor and translator', () => {
    const view = (getExtension(editor).options as LinkExtensionOptions).button({ editor, t });
    expect(view.componentProps.editor).toBe(editor);
    expect(view.componentProps.tooltip).toBe('editor.link.tooltip');
  });
});
