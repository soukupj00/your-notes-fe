import type { Editor } from '@tiptap/core';
import type { TFunction } from '../button-types';
import { toggleDefaultHighlight } from '../Highlight/Highlight';
import { openLinkPrompt } from '../Link/linkPrompt';
import { toggleWholeList } from '../list-toggle';
import { insertMath } from '../Mathematics/Mathematics';

type Action = (editor: Editor, t: TFunction) => void;

const heading =
  (level: 1 | 2 | 3): Action =>
  (editor) =>
    editor.chain().focus().toggleHeading({ level }).run();

const align =
  (alignment: 'left' | 'center' | 'right'): Action =>
  (editor) =>
    editor.chain().focus().toggleTextAlign(alignment).run();

/** What each editor Shortcut does: its button's action, keyed by the Toolbar Item id. */
export const EDITOR_ACTIONS: Record<string, Action> = {
  undo: (editor) => editor.chain().focus().undo().run(),
  redo: (editor) => editor.chain().focus().redo().run(),
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  bold: (editor) => editor.commands.toggleBold(),
  italic: (editor) => editor.commands.toggleItalic(),
  underline: (editor) => editor.commands.toggleUnderline(),
  strike: (editor) => editor.commands.toggleStrike(),
  code: (editor) => editor.commands.toggleCode(),
  clear: (editor) => editor.chain().focus().clearNodes().unsetAllMarks().run(),
  highlight: toggleDefaultHighlight,
  'bullet-list': (editor) => toggleWholeList(editor, (chain) => chain.toggleBulletList()),
  'ordered-list': (editor) => toggleWholeList(editor, (chain) => chain.toggleOrderedList()),
  'task-list': (editor) => toggleWholeList(editor, (chain) => chain.toggleTaskList()),
  'align-left': align('left'),
  'align-center': align('center'),
  'align-right': align('right'),
  blockquote: (editor) => editor.commands.toggleBlockquote(),
  'code-block': (editor) => editor.commands.toggleCodeBlock(),
  math: insertMath,
  link: openLinkPrompt,
};
