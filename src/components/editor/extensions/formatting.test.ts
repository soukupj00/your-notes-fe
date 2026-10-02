import type { Extendable } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import type { ButtonOption } from './button-types';
import {
  Blockquote,
  Bold,
  BulletList,
  Code,
  CodeBlock,
  HorizontalRule,
  Italic,
  OrderedList,
  Strike,
  Underline,
} from './formatting';

const t = (key: string) => key;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor(extensions: Extendable[], content = '<p>hello</p>') {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, ...extensions],
    content,
  });
  editors.push(editor);
  return editor;
}

function buttonProps(editor: Editor, name: string) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === name);
  if (!ext) throw new Error(`${name} not registered`);
  const view = (ext.options as ButtonOption).button({ editor, t });
  if (Array.isArray(view)) throw new Error(`${name} yields one button`);
  return view.componentProps;
}

// One row per toggle. `extra` is what the extension needs beside the document skeleton.
const TOGGLES = [
  {
    name: 'bold',
    ext: Bold,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleBold(),
    html: '<strong>',
    icon: 'Bold',
    tooltip: 'editor.bold.tooltip',
    shortcut: ['Mod', 'B'],
  },
  {
    name: 'italic',
    ext: Italic,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleItalic(),
    html: '<em>',
    icon: 'Italic',
    tooltip: 'editor.italic.tooltip',
    shortcut: ['Mod', 'I'],
  },
  {
    name: 'strike',
    ext: Strike,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleStrike(),
    html: '<s>',
    icon: 'Strikethrough',
    tooltip: 'editor.strike.tooltip',
    shortcut: ['Mod', 'Shift', 'S'],
  },
  {
    name: 'underline',
    ext: Underline,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleUnderline(),
    html: '<u>',
    icon: 'Underline',
    tooltip: 'editor.underline.tooltip',
    shortcut: ['Mod', 'U'],
  },
  {
    name: 'code',
    ext: Code,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleCode(),
    html: '<code>',
    icon: 'Code',
    tooltip: 'editor.code.tooltip',
    shortcut: ['Mod', 'E'],
  },
  {
    name: 'codeBlock',
    ext: CodeBlock,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleCodeBlock(),
    html: '<pre>',
    icon: 'Code2',
    tooltip: 'editor.codeBlock.tooltip',
    shortcut: ['Mod', 'Alt', 'C'],
  },
  {
    name: 'blockquote',
    ext: Blockquote,
    extra: [],
    toggle: (e: Editor) => e.commands.toggleBlockquote(),
    html: '<blockquote>',
    icon: 'Quote',
    tooltip: 'editor.blockquote.tooltip',
    shortcut: ['Mod', 'Shift', 'B'],
  },
  {
    name: 'bulletList',
    ext: BulletList,
    extra: [ListItem],
    toggle: (e: Editor) => e.commands.toggleBulletList(),
    html: '<ul>',
    icon: 'List',
    tooltip: 'editor.bulletList.tooltip',
    shortcut: ['Mod', 'Shift', '8'],
  },
  {
    name: 'orderedList',
    ext: OrderedList,
    extra: [ListItem],
    toggle: (e: Editor) => e.commands.toggleOrderedList(),
    html: '<ol>',
    icon: 'ListOrdered',
    tooltip: 'editor.orderedList.tooltip',
    shortcut: ['Mod', 'Shift', '7'],
  },
];

describe.each(TOGGLES)('$name', ({ name, ext, extra, toggle, html, icon, tooltip, shortcut }) => {
  it('toggles on the selection and reports itself active', () => {
    const editor = createEditor([...extra, ext]);
    editor.commands.selectAll();
    expect(editor.isActive(name)).toBe(false);
    toggle(editor);
    expect(editor.isActive(name)).toBe(true);
    expect(editor.getHTML()).toContain(html);
  });

  it('exposes a Pattern A toggle button whose action does the same', () => {
    const editor = createEditor([...extra, ext]);
    const props = buttonProps(editor, name);
    expect(props.icon).toBe(icon);
    expect(props.tooltip).toBe(tooltip);
    expect(props.shortcutKeys).toEqual(shortcut);
    expect(props.toggle).toBe(true);

    editor.commands.selectAll();
    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});

describe('horizontalRule', () => {
  it('inserts a rule from its button, with no active state', () => {
    const editor = createEditor([HorizontalRule]);
    const props = buttonProps(editor, 'horizontalRule');
    expect(props.icon).toBe('Minus');
    expect(props.tooltip).toBe('editor.horizontalRule.tooltip');
    // A rule is an insert, not a toggle: there is no "cursor inside a rule".
    expect(props.isActive).toBeUndefined();
    expect(props.toggle).toBeUndefined();

    props.action?.();
    expect(editor.getHTML()).toContain('<hr');
  });
});

describe('blockquote', () => {
  it('turns "> " at the start of a paragraph into a blockquote', () => {
    const editor = createEditor([Blockquote], '<p></p>');
    editor.commands.focus();
    editor.commands.insertContent('>');
    const from = editor.state.selection.from;
    editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, from, ' ', () => editor.view.state.tr)
    );
    expect(editor.getHTML()).toContain('<blockquote>');
  });
});
