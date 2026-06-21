import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Heading, type HeadingExtensionOptions } from './Heading';

const t = (key: string, _opts?: Record<string, unknown>) => key;

function createEditor(content = '<p>title</p>') {
  return new Editor({
    extensions: [Document, Paragraph, Text, Heading],
    content,
  });
}

function getButtons(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'heading');
  if (!ext) throw new Error('heading extension not registered');
  return (ext.options as HeadingExtensionOptions).button({ editor, t });
}

describe('Heading extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('button factory', () => {
    it('returns an array of 3 buttons', () => {
      const buttons = getButtons(editor);
      expect(buttons).toHaveLength(3);
    });

    it('each button has the correct icon string key', () => {
      const buttons = getButtons(editor);
      expect(buttons[0].componentProps.icon).toBe('Heading1');
      expect(buttons[1].componentProps.icon).toBe('Heading2');
      expect(buttons[2].componentProps.icon).toBe('Heading3');
    });

    it('each button has the correct shortcutKeys', () => {
      const buttons = getButtons(editor);
      expect(buttons[0].componentProps.shortcutKeys).toEqual(['Mod', 'Alt', '1']);
      expect(buttons[1].componentProps.shortcutKeys).toEqual(['Mod', 'Alt', '2']);
      expect(buttons[2].componentProps.shortcutKeys).toEqual(['Mod', 'Alt', '3']);
    });

    it('each button has a tooltip with the heading key', () => {
      const buttons = getButtons(editor);
      for (const btn of buttons) {
        expect(btn.componentProps.tooltip).toBe('editor.heading.level');
      }
    });

    it('level-2 action toggles heading level 2 and isActive reflects it', () => {
      const buttons = getButtons(editor);
      editor.commands.selectAll();
      buttons[1].componentProps.action?.();
      expect(editor.isActive('heading', { level: 2 })).toBe(true);
      expect(buttons[1].componentProps.isActive?.()).toBe(true);
    });

    it('level-1 isActive is false when level-2 heading is active', () => {
      const buttons = getButtons(editor);
      editor.commands.selectAll();
      buttons[1].componentProps.action?.();
      expect(buttons[0].componentProps.isActive?.()).toBe(false);
    });
  });

  describe('markdown input rules', () => {
    it('converts "# " to an h1 heading', () => {
      editor.commands.focus();
      editor.commands.insertContent('#');
      const from = editor.state.selection.from;
      editor.view.someProp('handleTextInput', (f) =>
        f(editor.view, from, from, ' ', () => editor.view.state.tr)
      );
      expect(editor.getHTML()).toContain('<h1>');
    });

    it('converts "## " to an h2 heading', () => {
      editor.destroy();
      editor = createEditor('<p></p>');
      editor.commands.focus();
      editor.commands.insertContent('##');
      const from = editor.state.selection.from;
      editor.view.someProp('handleTextInput', (f) =>
        f(editor.view, from, from, ' ', () => editor.view.state.tr)
      );
      expect(editor.getHTML()).toContain('<h2>');
    });
  });
});
