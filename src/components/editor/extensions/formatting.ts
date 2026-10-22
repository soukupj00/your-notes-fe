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
import { withoutKeys } from './withoutKeys';

// The marks and blocks whose whole contribution is one button. An extension with more
// than its declaration (a node view, a plugin, its own behaviour) keeps a folder of its own.
// Their upstream keys go: the user's Shortcuts bind them instead (ADR 0026).

export const Bold = withButton(withoutKeys(TiptapBold, ['Mod-b', 'Mod-B']), ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold',
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));

export const Italic = withButton(
  withoutKeys(TiptapItalic, ['Mod-i', 'Mod-I']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.commands.toggleItalic(),
      isActive: () => editor.isActive('italic'),
      icon: 'Italic',
      tooltip: t('editor.italic.tooltip'),
      toggle: true,
    },
  })
);

export const Strike = withButton(withoutKeys(TiptapStrike, ['Mod-Shift-s']), ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleStrike(),
    isActive: () => editor.isActive('strike'),
    icon: 'Strikethrough',
    tooltip: t('editor.strike.tooltip'),
    toggle: true,
  },
}));

export const Underline = withButton(
  withoutKeys(TiptapUnderline, ['Mod-u', 'Mod-U']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.commands.toggleUnderline(),
      isActive: () => editor.isActive('underline'),
      icon: 'Underline',
      tooltip: t('editor.underline.tooltip'),
      toggle: true,
    },
  })
);

export const Code = withButton(withoutKeys(TiptapCode, ['Mod-e']), ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleCode(),
    isActive: () => editor.isActive('code'),
    icon: 'Code',
    tooltip: t('editor.code.tooltip'),
    toggle: true,
  },
}));

/** Plain, not the lowlight variant: highlighting would pull in a grammar bundle for a block
 *  that mostly holds a command or a snippet verbatim. */
export const CodeBlock = withButton(
  withoutKeys(TiptapCodeBlock, ['Mod-Alt-c']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.commands.toggleCodeBlock(),
      isActive: () => editor.isActive('codeBlock'),
      icon: 'Code2',
      tooltip: t('editor.codeBlock.tooltip'),
      toggle: true,
    },
  })
);

export const Blockquote = withButton(
  withoutKeys(TiptapBlockquote, ['Mod-Shift-b']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.commands.toggleBlockquote(),
      isActive: () => editor.isActive('blockquote'),
      icon: 'Quote',
      tooltip: t('editor.blockquote.tooltip'),
      toggle: true,
    },
  })
);

/** An insert, not a toggle, so the button has no active state. */
export const HorizontalRule = withButton(TiptapHorizontalRule, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.setHorizontalRule(),
    icon: 'Minus',
    tooltip: t('editor.horizontalRule.tooltip'),
  },
}));

export const BulletList = withButton(
  withoutKeys(TiptapBulletList, ['Mod-Shift-8']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => toggleWholeList(editor, (chain) => chain.toggleBulletList()),
      isActive: () => editor.isActive('bulletList'),
      icon: 'List',
      tooltip: t('editor.bulletList.tooltip'),
      toggle: true,
    },
  })
);

export const OrderedList = withButton(
  withoutKeys(TiptapOrderedList, ['Mod-Shift-7']),
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => toggleWholeList(editor, (chain) => chain.toggleOrderedList()),
      isActive: () => editor.isActive('orderedList'),
      icon: 'ListOrdered',
      tooltip: t('editor.orderedList.tooltip'),
      toggle: true,
    },
  })
);
