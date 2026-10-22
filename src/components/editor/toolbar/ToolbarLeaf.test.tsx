import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bold, Italic } from '@/components/editor/extensions/formatting';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { getToolbarItem } from './registry';
import { ToolbarLeaf } from './ToolbarLeaf';

const t = (key: string) => key;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** The tooltip draws the shortcut only for `(pointer: fine)`, which the shared setup never matches. */
function stubFinePointer() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

function renderLeaf(id: string) {
  const editor = new Editor({ extensions: [Document, Paragraph, Text, Bold, Italic] });
  editors.push(editor);
  const item = getToolbarItem(id);
  if (!item) throw new Error(`${id} missing from the registry`);
  render(
    <PreferencesProvider>
      <TooltipProvider delayDuration={0}>
        <ToolbarLeaf item={item} editor={editor as never} t={t} />
      </TooltipProvider>
    </PreferencesProvider>
  );
}

describe('ToolbarLeaf', () => {
  it.each([
    ['the user’s combination', 'bold', 'editor.bold.tooltip', 'editor.bold.tooltipCtrl + Alt + B'],
    ['no shortcut line when cleared', 'italic', 'editor.italic.tooltip', 'editor.italic.tooltip'],
  ])('shows %s in the tooltip', async (_label, id, name, tooltip) => {
    stubFinePointer();
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 2, shortcuts: { bold: 'Mod-Alt-b', italic: null } })
    );
    renderLeaf(id);

    await userEvent.hover(screen.getByRole('button', { name }));

    expect((await screen.findByRole('tooltip')).textContent).toBe(tooltip);
  });
});
