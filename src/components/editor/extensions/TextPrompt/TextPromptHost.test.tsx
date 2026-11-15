import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { TextPromptHost } from './TextPromptHost';
import { TextPrompt, type TextPromptRequest } from './textPrompt';

const t = (key: string) => key;
const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function ask(request: Partial<TextPromptRequest> = {}) {
  const editor = new Editor({ extensions: [Document, Paragraph, Text, TextPrompt] });
  editors.push(editor);
  render(<TextPromptHost editor={editor} t={t} />);
  let answer!: Promise<string | null>;
  act(() => {
    answer = editor.storage.textPrompt.ask({
      kind: 'url',
      title: 'Link URL',
      confirmLabel: 'Apply',
      ...request,
    });
  });
  return answer;
}

describe('TextPromptHost', () => {
  it('shows nothing until a question is asked', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, TextPrompt] });
    editors.push(editor);
    render(<TextPromptHost editor={editor} t={t} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('answers with what was typed, on Enter, and closes', async () => {
    const answer = ask();

    await userEvent.type(screen.getByRole('textbox', { name: 'Link URL' }), 'https://a.cz{Enter}');

    await expect(answer).resolves.toBe('https://a.cz');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts from the text the question brings', async () => {
    const answer = ask({ kind: 'math', title: 'Enter LaTeX', initial: 'a+b' });

    expect(screen.getByRole('textbox', { name: 'Enter LaTeX' })).toHaveValue('a+b');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await expect(answer).resolves.toBe('a+b');
  });

  it.each([
    ['Cancel', () => userEvent.click(screen.getByRole('button', { name: 'editor.prompt.cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('answers null on %s', async (_, cancel) => {
    const answer = ask();

    await cancel();

    await expect(answer).resolves.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('previews a formula as it is typed, and nothing for a link', async () => {
    void ask({ kind: 'math', title: 'Enter LaTeX' });
    expect(screen.queryByTestId('math-preview')).toBeNull();

    await userEvent.type(screen.getByRole('textbox', { name: 'Enter LaTeX' }), 'x^2');

    expect(screen.getByTestId('math-preview').querySelector('.katex')).not.toBeNull();
  });
});
