import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Color } from './Color';
import { EditorColorPickerButton } from './EditorColorPickerButton';
import { Highlight } from './Highlight';

const editors: Editor[] = [];

function createEditor() {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, TextStyle, Color, Highlight],
    content: '<p>hello</p>',
  });
  editors.push(editor);
  editor.commands.selectAll();
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe('editor color picker buttons', () => {
  it('commits text color to the selection captured when the picker opens', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <EditorColorPickerButton editor={editor} tooltip="Text color" variant="text" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Red' }));

    expect(editor.getAttributes('textStyle').color).toBe('#ef4444');
  });

  it('commits highlight color to the selection captured when the picker opens', async () => {
    const editor = createEditor();
    render(
      <TooltipProvider>
        <EditorColorPickerButton editor={editor} tooltip="Highlight" variant="highlight" />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Highlight' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yellow' }));

    expect(editor.getAttributes('textStyle').backgroundColor).toBe('#fef08a');
  });
});
