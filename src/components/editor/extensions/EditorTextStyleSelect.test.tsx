import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditorTextStyleSelect } from './EditorTextStyleSelect';
import { FontFamily } from './FontFamily';
import { FontSize } from './FontSize';

const editors: Editor[] = [];

function createEditor() {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, FontFamily, FontSize],
    content: '<p>hello</p>',
  });
  editors.push(editor);
  editor.commands.selectAll();
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

// Keys pass through untranslated so assertions read as the key, not the copy.
const t = (key: string) => key;

describe('editor text style selects', () => {
  it('applies a selected font family', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <EditorTextStyleSelect editor={editor} t={t} tooltip="Font family" variant="fontFamily" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Font family' }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'editor.fontFamily.options.serif' })
    );

    expect(editor.getAttributes('textStyle').fontFamily).toBe('ui-serif, Georgia, serif');
  });

  it('applies a selected font size', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <EditorTextStyleSelect editor={editor} t={t} tooltip="Font size" variant="fontSize" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Font size' }));
    await userEvent.click(await screen.findByRole('option', { name: '24px' }));

    expect(editor.getAttributes('textStyle').fontSize).toBe('24px');
  });

  // Both used to read "Default", and on a phone the tooltip that told them apart never appears.
  it('distinguishes the two selects on the closed trigger, without a tooltip', () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <EditorTextStyleSelect editor={editor} t={t} tooltip="Font family" variant="fontFamily" />
        <EditorTextStyleSelect editor={editor} t={t} tooltip="Font size" variant="fontSize" />
      </TooltipProvider>
    );

    const [family, size] = screen.getAllByRole('combobox');
    expect(family).toHaveTextContent('Aa');
    expect(size).toHaveTextContent('Auto');
    expect(family.querySelector('svg')).toBeTruthy();
    expect(size.querySelector('svg')).toBeTruthy();
  });
});
