import { Blockquote as TiptapBlockquote } from '@tiptap/extension-blockquote';
import { Bold as TiptapBold } from '@tiptap/extension-bold';
import { Code as TiptapCode } from '@tiptap/extension-code';
import { CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block';
import { HorizontalRule as TiptapHorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Italic as TiptapItalic } from '@tiptap/extension-italic';
import {
  BulletList as TiptapBulletList,
  OrderedList as TiptapOrderedList,
} from '@tiptap/extension-list';
import { Strike as TiptapStrike } from '@tiptap/extension-strike';
import { Underline as TiptapUnderline } from '@tiptap/extension-underline';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { toggleWholeList } from './list-toggle';
import { withButton } from './withButton';

// The marks and blocks whose whole contribution is one button. An extension with more
// than its declaration (a node view, a plugin, its own behaviour) keeps a folder of its own.

export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    shortcutKeys: ['Mod', 'B'],
    icon: 'Bold',
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));

export const Italic = withButton(TiptapItalic, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleItalic(),
    isActive: () => editor.isActive('italic'),
    shortcutKeys: ['Mod', 'I'],
    icon: 'Italic',
    tooltip: t('editor.italic.tooltip'),
    toggle: true,
  },
}));

export const Strike = withButton(TiptapStrike, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleStrike(),
    isActive: () => editor.isActive('strike'),
    shortcutKeys: ['Mod', 'Shift', 'S'],
    icon: 'Strikethrough',
    tooltip: t('editor.strike.tooltip'),
    toggle: true,
  },
}));

export const Underline = withButton(TiptapUnderline, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleUnderline(),
    isActive: () => editor.isActive('underline'),
    shortcutKeys: ['Mod', 'U'],
    icon: 'Underline',
    tooltip: t('editor.underline.tooltip'),
    toggle: true,
  },
}));

export const Code = withButton(TiptapCode, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleCode(),
    isActive: () => editor.isActive('code'),
    shortcutKeys: ['Mod', 'E'],
    icon: 'Code',
    tooltip: t('editor.code.tooltip'),
    toggle: true,
  },
}));

/** Plain, not the lowlight variant: highlighting would pull in a grammar bundle for a block
 *  that mostly holds a command or a snippet verbatim. */
export const CodeBlock = withButton(TiptapCodeBlock, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleCodeBlock(),
    isActive: () => editor.isActive('codeBlock'),
    shortcutKeys: ['Mod', 'Alt', 'C'],
    icon: 'Code2',
    tooltip: t('editor.codeBlock.tooltip'),
    toggle: true,
  },
}));

export const Blockquote = withButton(TiptapBlockquote, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBlockquote(),
    isActive: () => editor.isActive('blockquote'),
    shortcutKeys: ['Mod', 'Shift', 'B'],
    icon: 'Quote',
    tooltip: t('editor.blockquote.tooltip'),
    toggle: true,
  },
}));

/** An insert, not a toggle, so the button has no active state. */
export const HorizontalRule = withButton(TiptapHorizontalRule, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.setHorizontalRule(),
    icon: 'Minus',
    tooltip: t('editor.horizontalRule.tooltip'),
  },
}));

export const BulletList = withButton(TiptapBulletList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleBulletList()),
    isActive: () => editor.isActive('bulletList'),
    shortcutKeys: ['Mod', 'Shift', '8'],
    icon: 'List',
    tooltip: t('editor.bulletList.tooltip'),
    toggle: true,
  },
}));

export const OrderedList = withButton(TiptapOrderedList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleOrderedList()),
    isActive: () => editor.isActive('orderedList'),
    shortcutKeys: ['Mod', 'Shift', '7'],
    icon: 'ListOrdered',
    tooltip: t('editor.orderedList.tooltip'),
    toggle: true,
  },
}));
