import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FontFamily } from './FontFamily';
import { FontFamilyButton } from './FontFamily/FontFamilyButton';
import { FontSize } from './FontSize';
import { FontSizeButton } from './FontSize/FontSizeButton';

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

describe('editor text style selects', () => {
  it('applies a selected font family', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <FontFamilyButton editor={editor} tooltip="Font family" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Font family' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Serif' }));

    expect(editor.getAttributes('textStyle').fontFamily).toBe('ui-serif, Georgia, serif');
  });

  it('applies a selected font size', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <FontSizeButton editor={editor} tooltip="Font size" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Font size' }));
    await userEvent.click(await screen.findByRole('option', { name: '24px' }));

    expect(editor.getAttributes('textStyle').fontSize).toBe('24px');
  });
});
