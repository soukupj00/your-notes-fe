import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { Bold, BulletList, OrderedList } from '@/components/editor/extensions/formatting';
import { Heading } from '@/components/editor/extensions/Heading';
import { createLink } from '@/components/editor/extensions/Link/Link';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getToolbarFamily, itemsInFamily } from './registry';
import { ToolbarFamilyMenu, triggerIcon } from './ToolbarFamilyMenu';
import type { ToolbarFamilyId, ToolbarItem } from './types';

const t = (key: string) => key;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor(content = '<p>hello</p>') {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Bold, Heading, BulletList, OrderedList, ListItem],
    content,
  });
  editors.push(editor);
  return editor;
}

function family(id: ToolbarFamilyId) {
  const found = getToolbarFamily(id);
  if (!found) throw new Error(`${id} missing from the registry`);
  return found;
}

function renderMenu(id: ToolbarFamilyId, editor: Editor, items: ToolbarItem[] = itemsInFamily(id)) {
  render(
    <TooltipProvider>
      <ToolbarFamilyMenu family={family(id)} items={items} editor={editor} t={t} />
    </TooltipProvider>
  );
}

describe('ToolbarFamilyMenu', () => {
  it('renders exactly one trigger for the whole family', () => {
    renderMenu('style', createEditor());
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('toolbar-family-style')).toBeInTheDocument();
  });

  it('opens the family real leaf buttons, and only the ones that are on', async () => {
    const editor = createEditor();
    // `h2` off: a leaf switched off is gone from inside the menu too, not just
    // from the bar.
    renderMenu(
      'style',
      editor,
      itemsInFamily('style').filter((item) => item.id !== 'h2')
    );

    await userEvent.click(screen.getByTestId('toolbar-family-style'));
    // H1 and H3 only - three leaves minus the one switched off. They keep the
    // extension's own accessible name, because they are the same buttons.
    expect(screen.getByRole('button', { name: 'editor.heading.h1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.heading.h3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'editor.heading.h2' })).not.toBeInTheDocument();
  });

  it('labels each row with its name instead of a floating tooltip', async () => {
    // A tooltip stacked over a popover is both redundant and mispositioned, and
    // on touch it never appears at all - so the menu says it in the row.
    renderMenu('style', createEditor());
    await userEvent.click(screen.getByTestId('toolbar-family-style'));

    const row = screen.getByRole('button', { name: 'editor.heading.h1' });
    expect(row).toHaveTextContent('editor.heading.h1');
  });

  it('keeps the keyboard shortcut off the row', async () => {
    // A collapsed family is overwhelmingly a phone, and the row is drawn the
    // same on both. The tooltip is where a shortcut belongs - `ActionButton`
    // shows it there, and only to a fine pointer.
    renderMenu('style', createEditor());
    await userEvent.click(screen.getByTestId('toolbar-family-style'));

    // `h1` is Mod+Alt+1, so the row would carry a modifier symbol if it drew one.
    for (const row of screen.getAllByRole('button', { name: /^editor\.heading\.h\d$/ })) {
      expect(row.textContent).not.toMatch(/[⌘⌥⇧^]|Ctrl|Alt|Shift/);
    }
  });

  it('names a leaf whose button is a custom component, not just a plain one', async () => {
    // `link` wraps an `ActionButton` rather than being one, like the attachment pickers
    // and colour triggers: no prop could reach the button, so each drew nameless.
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, Bold, createLink(t)],
      content: '<p>hello</p>',
    });
    editors.push(editor);
    renderMenu(
      'media',
      editor,
      itemsInFamily('media').filter((item) => item.id === 'link')
    );

    await userEvent.click(screen.getByTestId('toolbar-family-media'));

    // Its name is drawn on the row, not left to a tooltip nobody on a phone
    // will ever see.
    expect(screen.getByRole('button', { name: 'editor.link.tooltip' })).toHaveTextContent(
      'editor.link.tooltip'
    );
  });

  it('reports the caret context on a state-reporting trigger', () => {
    const editor = createEditor('<h2>a heading</h2>');
    editor.commands.setTextSelection(3);
    expect(triggerIcon(family('style'), itemsInFamily('style'), editor, t)).toBe('Heading2');

    // Outside a heading it falls back to the paragraph mark rather than a blank.
    editor.commands.setContent('<p>plain</p>');
    editor.commands.setTextSelection(3);
    expect(triggerIcon(family('style'), itemsInFamily('style'), editor, t)).toBe('Pilcrow');
  });

  it('keeps a static icon on a family with nothing to be "in"', () => {
    const editor = createEditor();
    // Bold and italic can both be on at once, so `format` reports nothing.
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setBold();
    expect(triggerIcon(family('format'), itemsInFamily('format'), editor, t)).toBe(
      family('format').icon
    );
  });

  it('renders nothing when none of its leaves resolves', () => {
    // This editor mounts no media extensions at all, so a `media` menu would be
    // a trigger that opens an empty popover.
    const { container } = render(
      <TooltipProvider>
        <ToolbarFamilyMenu
          family={family('media')}
          items={itemsInFamily('media')}
          editor={createEditor()}
          t={t}
        />
      </TooltipProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
