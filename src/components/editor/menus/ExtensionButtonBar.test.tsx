import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { Bold } from '@/components/editor/extensions/Bold';
import { Heading } from '@/components/editor/extensions/Heading';
import { TooltipProvider } from '@/components/ui/tooltip';
import ExtensionButtonBar from './ExtensionButtonBar';

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Bold, Heading],
    content: '<p>hi</p>',
  });
}

function renderBar(editor: Editor, names: string[]) {
  return render(
    <TooltipProvider>
      <ExtensionButtonBar editor={editor} names={names} />
    </TooltipProvider>
  );
}

describe('ExtensionButtonBar', () => {
  let editor: Editor;
  afterEach(() => editor.destroy());

  it('renders one button for a single-button extension and one per button for an array', () => {
    editor = createEditor();
    // Heading contributes a 3-button array (H1-H3); Bold contributes a single button.
    renderBar(editor, ['heading', 'bold']);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('skips names with no registered extension or no button', () => {
    editor = createEditor();
    // 'text' (the Text extension) exposes no button; 'nope' is not registered.
    renderBar(editor, ['bold', 'text', 'nope']);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
