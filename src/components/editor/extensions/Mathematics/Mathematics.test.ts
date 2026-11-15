import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextPrompt } from '../TextPrompt/textPrompt';
import { Mathematics, type MathematicsExtensionOptions } from './Mathematics';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Mathematics, TextPrompt],
    content: '<p>formula </p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'Mathematics');
  if (!ext) throw new Error('Mathematics not registered');
  return (ext.options as MathematicsExtensionOptions).button({ editor, t }).componentProps;
}

/** Stands in for `TextPromptHost`: answers every question with `value`. */
function answerPrompts(editor: Editor, value: string | null) {
  const asked = vi.fn();
  editor.storage.textPrompt.registerHost((request, answer) => {
    asked(request);
    answer(value);
  });
  return asked;
}

function hasInlineMath(editor: Editor, latex?: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'inlineMath' && (latex === undefined || node.attrs.latex === latex)) {
      found = true;
    }
  });
  return found;
}

describe('Mathematics extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
    vi.restoreAllMocks();
  });

  it('registers inline and block math nodes', () => {
    const names = editor.extensionManager.extensions.map((e) => e.name);
    expect(names).toContain('inlineMath');
    expect(names).toContain('blockMath');
  });

  it('inserts an inlineMath node with the given latex via command', () => {
    editor.commands.insertInlineMath({ latex: 'a+b' });
    expect(hasInlineMath(editor, 'a+b')).toBe(true);
  });

  it('button exposes correct Pattern A props', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Latex');
    expect(props.tooltip).toBe('editor.math.tooltip');
    expect(props.toggle).toBe(true);
    expect(typeof props.isActive?.()).toBe('boolean');
  });

  it('button action inserts the LaTeX entered at the prompt', async () => {
    const asked = answerPrompts(editor, '\\frac{a}{b}');
    getButtonProps(editor).action?.();
    await vi.waitFor(() => expect(hasInlineMath(editor, '\\frac{a}{b}')).toBe(true));
    expect(asked).toHaveBeenCalledWith({
      kind: 'math',
      title: 'editor.math.prompt',
      confirmLabel: 'editor.math.insert',
    });
  });

  it.each([
    ['is cancelled', null],
    ['is answered with nothing', '  '],
  ])('button action inserts nothing when the prompt %s', async (_, value) => {
    const asked = answerPrompts(editor, value);
    getButtonProps(editor).action?.();
    await vi.waitFor(() => expect(asked).toHaveBeenCalled());
    await Promise.resolve();
    expect(hasInlineMath(editor)).toBe(false);
  });
});
