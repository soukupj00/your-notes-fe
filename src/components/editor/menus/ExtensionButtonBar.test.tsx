import { render, screen } from '@testing-library/react';
import { Editor, Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { Bold } from '@/components/editor/extensions/Bold';
import { ActionButton } from '@/components/ui/ActionButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import ExtensionButtonBar from './ExtensionButtonBar';

// A stand-in extension whose button factory returns an array (like Heading / history).
const TwoButtons = Extension.create({
  name: 'twoButtons',
  addOptions() {
    return {
      button: () => [
        { component: ActionButton, componentProps: { icon: 'Bold', tooltip: 'one', toggle: true } },
        {
          component: ActionButton,
          componentProps: { icon: 'Italic', tooltip: 'two', toggle: true },
        },
      ],
    };
  },
});

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Bold, TwoButtons],
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
    // Bold contributes a single button; twoButtons contributes an array of two.
    renderBar(editor, ['bold', 'twoButtons']);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('skips names with no registered extension or no button', () => {
    editor = createEditor();
    // 'text' (the Text extension) exposes no button; 'nope' is not registered.
    renderBar(editor, ['bold', 'text', 'nope']);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
