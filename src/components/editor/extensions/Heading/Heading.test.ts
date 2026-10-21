import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ButtonOption, ButtonView } from '../button-types';
import { Heading } from './Heading';

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
  return (ext.options as ButtonOption<ButtonView[]>).button({ editor, t });
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

    // Per level, and pinned to keys that actually exist: the interpolated
    // `editor.heading.level` these used to share was in no translation file, so
    // the tooltip rendered as the raw key and i18next warned on every rebuild.
    it('each button has the tooltip key for its own level', () => {
      const buttons = getButtons(editor);
      expect(buttons.map((btn) => btn.componentProps.tooltip)).toEqual([
        'editor.heading.h1',
        'editor.heading.h2',
        'editor.heading.h3',
      ]);
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

  describe('levels 4-6', () => {
    it.each([4, 5, 6])('Mod-Alt-%i leaves the paragraph alone', (level) => {
      editor.commands.focus();
      editor.commands.keyboardShortcut(`Mod-Alt-${level}`);
      expect(editor.getHTML()).toBe('<p>title</p>');
    });

    // A stored or pasted h4-h6 keeps its text, as a paragraph.
    it.each([4, 5, 6])('reads an <h%i> as a paragraph', (level) => {
      editor.commands.setContent(`<h${level}>old</h${level}>`);
      expect(editor.getHTML()).toBe('<p>old</p>');
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
