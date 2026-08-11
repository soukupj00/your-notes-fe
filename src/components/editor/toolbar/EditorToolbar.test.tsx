import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { setViewport } from '@/test/viewport.ts';
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

/**
 * Make the bar believe its row is wider than its box.
 *
 * jsdom lays nothing out, so every element measures 0 and `useEdgeFade` can
 * never discover an overflow - which since Step 8 is the only condition that
 * pins anything. These are the two numbers it reads; the returned function must
 * be called, as this repo does not set `restoreMocks`.
 */
function stubOverflow({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  const spies = [
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth),
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth),
  ];
  return () => {
    for (const spy of spies) spy.mockRestore();
  };
}

function renderToolbar(layout?: ToolbarLayout) {
  const editor = createEditor();
  render(
    // The `⚙` opens the Layout editor, which reads the preferences store.
    <PreferencesProvider>
      <TooltipProvider>
        <EditorToolbar editor={editor} layouts={{ compact: layout, wide: layout }} />
      </TooltipProvider>
    </PreferencesProvider>
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
  beforeEach(() => setViewport(1024));

  it('renders the resolved items in the stored order', () => {
    renderToolbar(LAYOUT);
    expect(renderedNames()).toEqual([
      'editor.orderedList.tooltip',
      'editor.bulletList.tooltip',
      'editor.italic.tooltip',
      'editor.bold.tooltip',
      // Reconciliation appends the families this stored Layout predates, and
      // `meta` is on by default - "absent means new, not hidden".
      'editor.toolbar.customize',
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
      'editor.toolbar.customize',
    ]);
  });

  it('pins the first family on a compact bar that scrolls, and only there', () => {
    const restore = stubOverflow({ scrollWidth: 500, clientWidth: 312 });
    try {
      setViewport(360);
      renderToolbar(LAYOUT);
      const pinned = screen.getByTestId('editor-toolbar').querySelectorAll('[data-pinned]');
      // Exactly one, and it is the first family in the user's order.
      expect(pinned).toHaveLength(1);
      expect(pinned[0].querySelector('button')?.getAttribute('aria-label')).toBe(
        'editor.orderedList.tooltip'
      );

      cleanup();
      setViewport(1024);
      renderToolbar(LAYOUT);
      // A wide bar wraps rather than scrolls, so nothing can scroll away from it.
      expect(screen.getByTestId('editor-toolbar').querySelectorAll('[data-pinned]')).toHaveLength(
        0
      );
    } finally {
      restore();
    }
  });

  it('leaves a bar that fits unpinned, so its buttons can be spaced evenly', () => {
    const restore = stubOverflow({ scrollWidth: 292, clientWidth: 312 });
    try {
      setViewport(360);
      renderToolbar(LAYOUT);
      // Nothing can scroll under a pin on a bar with nothing to scroll, and the
      // wrapper would cost the even spacing: it makes its family one flex item,
      // which `justify-between` spreads around instead of within.
      expect(screen.getByTestId('editor-toolbar').querySelectorAll('[data-pinned]')).toHaveLength(
        0
      );
    } finally {
      restore();
    }
  });

  it('wraps the pinned family without costing the row any width', () => {
    const restore = stubOverflow({ scrollWidth: 500, clientWidth: 312 });
    try {
      setViewport(360);
      renderToolbar(LAYOUT);
      const bar = screen.getByTestId('editor-toolbar');
      const pin = bar.querySelector('[data-pinned]');
      // Padding here would latch the pin on: a bar that fit unpinned would
      // overflow *because* it pinned, and could then never unpin. The wrapper
      // must therefore measure exactly what its buttons measure - same gap as
      // the bar, nothing else.
      expect(pin?.className).toContain('gap-1');
      expect(pin?.className).not.toMatch(/(^|\s)-?p[xlrtby]?-/);
    } finally {
      restore();
    }
  });

  it('never fades the edge the pinned family sits on', () => {
    const restore = stubOverflow({ scrollWidth: 500, clientWidth: 312 });
    try {
      setViewport(360);
      renderToolbar(LAYOUT);
      expect(screen.getByTestId('editor-toolbar').dataset.overflowStart).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('wraps on a wide window and scrolls on a compact one, never wrapping there', () => {
    setViewport(1024);
    renderToolbar(LAYOUT);
    const wide = screen.getByTestId('editor-toolbar');
    expect(wide.dataset.widthClass).toBe('wide');
    expect(wide.className).toContain('flex-wrap');

    cleanup();
    setViewport(360);
    renderToolbar(LAYOUT);
    const compact = screen.getByTestId('editor-toolbar');
    expect(compact.dataset.widthClass).toBe('compact');
    // Stealing vertical space from the note above the keyboard is the one thing
    // this bar may not do, so it scrolls instead of wrapping.
    expect(compact.className).not.toContain('flex-wrap');
    expect(compact.className).toContain('overflow-x-auto');
    // Spread across the width it has rather than bunched at the left edge.
    // Safe to apply unconditionally: there is no free space to distribute on a
    // bar that overflows, so this is inert exactly when it would be wrong.
    expect(compact.className).toContain('justify-between');
  });
});

/** Just the gear, which is the whole `meta` family. */
const META_ONLY: ToolbarLayout = [
  { id: 'meta', on: true, collapsed: false, members: [{ id: 'customize', on: true }] },
];

describe('the customize gear', () => {
  beforeEach(() => setViewport(1024));

  it('renders even though no extension backs it', () => {
    renderToolbar(META_ONLY);

    // Every other Item is dropped when its extension is unmounted; this one has
    // no extension at all, and dropping it would leave no way into the sheet.
    expect(screen.getByTestId('toolbar-customize')).toBeInTheDocument();
  });

  it('opens the Layout editor in a sheet, without navigating away', async () => {
    const user = userEvent.setup();
    renderToolbar(META_ONLY);

    await user.click(screen.getByTestId('toolbar-customize'));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('settings.toolbar.title')).toBeInTheDocument();
    // The bar it is editing is still mounted behind it: nothing was routed to,
    // so an unsaved draft in the editor is untouched.
    expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument();
  });

  it('leaves Settings as the only way in once it is switched off', () => {
    renderToolbar([
      { id: 'meta', on: true, collapsed: false, members: [{ id: 'customize', on: false }] },
    ]);

    expect(screen.queryByTestId('toolbar-customize')).not.toBeInTheDocument();
  });
});
