import { cleanup, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bold } from '@/components/editor/extensions/Bold';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { Italic } from '@/components/editor/extensions/Italic';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { OrderedList } from '@/components/editor/extensions/OrderedList';
import { TooltipProvider } from '@/components/ui/tooltip';
import EditorToolbar from './EditorToolbar';
import type { ToolbarLayout } from './types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor() {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Bold, Italic, BulletList, OrderedList, ListItem],
    content: '<p>hi</p>',
  });
  editors.push(editor);
  return editor;
}

function setWidth(px: number) {
  window.innerWidth = px;
}

function renderToolbar(layout?: ToolbarLayout) {
  const editor = createEditor();
  render(
    <TooltipProvider>
      <EditorToolbar editor={editor} layout={layout} />
    </TooltipProvider>
  );
}

/** The buttons the bar drew, in DOM order, by accessible name. */
function renderedNames(): string[] {
  return Array.from(screen.getByTestId('editor-toolbar').querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent ?? ''
  );
}

const LAYOUT: ToolbarLayout = [
  {
    id: 'list',
    on: true,
    collapsed: false,
    members: [
      { id: 'ordered-list', on: true },
      { id: 'bullet-list', on: true },
      { id: 'task-list', on: false },
    ],
  },
  {
    id: 'format',
    on: true,
    collapsed: false,
    members: [
      { id: 'italic', on: true },
      { id: 'bold', on: true },
      { id: 'strike', on: false },
      { id: 'underline', on: false },
      { id: 'code', on: false },
      { id: 'link', on: false },
      { id: 'clear', on: false },
    ],
  },
];

describe('EditorToolbar', () => {
  beforeEach(() => setWidth(1024));

  it('renders the resolved items in the stored order', () => {
    renderToolbar(LAYOUT);
    expect(renderedNames()).toEqual([
      'editor.orderedList.tooltip',
      'editor.bulletList.tooltip',
      'editor.italic.tooltip',
      'editor.bold.tooltip',
    ]);
  });

  it('skips an item whose extension is not mounted, rather than blanking the bar', () => {
    // This editor has no Mathematics or media extensions, so `block` and
    // `media` cannot resolve - the rest of the bar must still draw.
    renderToolbar([
      ...LAYOUT,
      {
        id: 'block',
        on: true,
        collapsed: false,
        members: [
          { id: 'math', on: true },
          { id: 'blockquote', on: false },
          { id: 'code-block', on: false },
          { id: 'divider', on: false },
        ],
      },
    ]);
    expect(renderedNames()).toContain('editor.bold.tooltip');
    expect(renderedNames()).not.toContain('editor.math.tooltip');
  });

  it('draws a collapsed family as one trigger instead of its leaves', () => {
    renderToolbar([{ ...LAYOUT[0], collapsed: true }, LAYOUT[1]]);
    // The two list leaves become one trigger; format stays expanded.
    expect(renderedNames()).toEqual([
      'editor.toolbar.family.list',
      'editor.italic.tooltip',
      'editor.bold.tooltip',
    ]);
  });

  it('wraps on a wide window and scrolls on a compact one, never wrapping there', () => {
    setWidth(1024);
    renderToolbar(LAYOUT);
    const wide = screen.getByTestId('editor-toolbar');
    expect(wide.dataset.widthClass).toBe('wide');
    expect(wide.className).toContain('flex-wrap');

    cleanup();
    setWidth(360);
    renderToolbar(LAYOUT);
    const compact = screen.getByTestId('editor-toolbar');
    expect(compact.dataset.widthClass).toBe('compact');
    // Stealing vertical space from the note above the keyboard is the one thing
    // this bar may not do, so it scrolls instead of wrapping.
    expect(compact.className).not.toContain('flex-wrap');
    expect(compact.className).toContain('overflow-x-auto');
  });
});
