import { Editor } from '@tiptap/core';
import { Bold as TiptapBold } from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonOption, ButtonView } from './button-types';
import { withButton } from './withButton';

const t = (key: string) => key;

const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold',
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));

const Heading = withButton(TiptapHeading, ({ editor, t }) =>
  ([1, 2, 3] as const).map((level) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.chain().focus().toggleHeading({ level }).run(),
      isActive: () => editor.isActive('heading', { level }),
      icon: `Heading${level}`,
      tooltip: t(`editor.heading.h${level}`),
      toggle: true,
    },
  }))
);

const TextAlign = withButton(
  TiptapTextAlign,
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.chain().focus().toggleTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      icon: 'AlignCenter',
      tooltip: t('editor.textAlign.center'),
      toggle: true,
    },
  }),
  { types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }
);

// Not a runtime case: a misspelt icon must fail the typecheck rather than render an empty button.
withButton(TiptapBold, () => ({
  component: ActionButton,
  // @ts-expect-error icon names are checked against the registry
  componentProps: { icon: 'Bolf' },
}));

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor() {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Bold, Heading, TextAlign],
    content: '<p>hi</p>',
  });
  editors.push(editor);
  return editor;
}

function optionsOf(editor: Editor, name: string) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === name);
  if (!ext) throw new Error(`${name} not registered`);
  return ext.options as ButtonOption<ButtonView | ButtonView[]> & Record<string, unknown>;
}

describe('withButton', () => {
  it('keeps the upstream behaviour and adds the button', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.toggleBold();
    expect(editor.getHTML()).toContain('<strong>');

    const view = optionsOf(editor, 'bold').button({ editor, t });
    if (Array.isArray(view)) throw new Error('bold yields one button');
    expect(view.component).toBe(ActionButton);
    expect(view.componentProps.icon).toBe('Bold');
    expect(view.componentProps.isActive?.()).toBe(true);
  });

  it('passes an array through for an extension that yields several buttons', () => {
    const editor = createEditor();
    const views = optionsOf(editor, 'heading').button({ editor, t });
    if (!Array.isArray(views)) throw new Error('heading yields three buttons');
    expect(views.map((v) => v.componentProps.icon)).toEqual(['Heading1', 'Heading2', 'Heading3']);
  });

  it('merges extra options under the button, so a wrapper can still configure upstream', () => {
    const editor = createEditor();
    const options = optionsOf(editor, 'textAlign');
    expect(options.types).toEqual(['heading', 'paragraph']);
    expect(options.alignments).toEqual(['left', 'center', 'right']);
    editor.commands.selectAll();
    editor.commands.setTextAlign('center');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
  });
});
