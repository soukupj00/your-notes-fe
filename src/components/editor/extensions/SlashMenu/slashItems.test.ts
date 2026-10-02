import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolbarItem } from '@/components/editor/toolbar/registry';
import type { AttachmentDeps } from '../attachments/deps';
import { insertFiles } from '../attachments/insert';
import { Blockquote, BulletList, CodeBlock, HorizontalRule, OrderedList } from '../formatting';
import { Heading } from '../Heading';
import { ListItem } from '../ListItem';
import { filterSlashItems, SLASH_ITEMS } from './slashItems';

vi.mock('../attachments/insert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../attachments/insert')>()),
  insertFiles: vi.fn(),
}));

// The menu's labels come from the registry now, so the stand-in `t` has to
// resolve the *registry's* keys rather than a `slash` namespace of its own.
const t = (key: string) => key.split('.').pop() ?? key;

function createEditor() {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading,
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      CodeBlock,
      HorizontalRule,
    ],
    content: '<p></p>',
  });
}

function item(key: string) {
  const found = SLASH_ITEMS.find((i) => i.key === key);
  if (!found) throw new Error(`no slash item ${key}`);
  return found;
}

describe('filterSlashItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterSlashItems('', t)).toHaveLength(SLASH_ITEMS.length);
  });

  it('matches on the visible label', () => {
    const keys = filterSlashItems('divider', t).map((i) => i.key);
    expect(keys).toContain('divider');
  });

  // A menu that only matched our own wording would make the user guess it.
  it('matches on keywords the label does not contain', () => {
    expect(filterSlashItems('todo', t).map((i) => i.key)).toContain('task-list');
    expect(filterSlashItems('bullet', t).map((i) => i.key)).toContain('bullet-list');
    expect(filterSlashItems('sketch', t).map((i) => i.key)).toContain('drawing');
  });

  it('narrows to nothing for a query that matches no item', () => {
    expect(filterSlashItems('zzzzz', t)).toEqual([]);
  });
});

describe('slash item commands', () => {
  let editor: Editor;
  let deps: AttachmentDeps;

  beforeEach(() => {
    editor = createEditor();
    deps = { openExcalidraw: vi.fn(), t } as unknown as AttachmentDeps;
  });
  afterEach(() => {
    editor.destroy();
    vi.restoreAllMocks();
  });

  /** Stand in for what Suggestion passes: the range covering the typed `/query`. */
  function runWithTypedQuery(key: string, typed: string) {
    editor.commands.focus();
    editor.commands.insertContent(typed);
    const to = editor.state.selection.from;
    item(key).run({ editor, range: { from: to - typed.length, to }, deps, t });
  }

  it.each([
    ['h1', '<h1>'],
    ['bullet-list', '<ul>'],
    ['ordered-list', '<ol>'],
    ['blockquote', '<blockquote>'],
    ['code-block', '<pre>'],
    ['divider', '<hr'],
  ])('%s inserts its block', (key, expected) => {
    runWithTypedQuery(key, '/x');
    expect(editor.getHTML()).toContain(expected);
  });

  // Every item consumes the range, or the query it was chosen from stays behind.
  it('removes the typed query rather than leaving it in the document', () => {
    runWithTypedQuery('bullet-list', '/bullet');
    expect(editor.getText()).not.toContain('/bullet');
  });

  // Decision 13: one id space. `math` was once a bar button with no slash item.
  it('names only actions the registry knows', () => {
    for (const slashItem of SLASH_ITEMS) {
      expect(getToolbarItem(slashItem.key), slashItem.key).toBeDefined();
    }
    expect(SLASH_ITEMS.map((slashItem) => slashItem.key)).toContain('math');
  });

  it('opens the drawing surface rather than inserting a node itself', () => {
    runWithTypedQuery('drawing', '/draw');
    expect(deps.openExcalidraw).toHaveBeenCalledOnce();
  });

  // The slash video used to skip the derived data the toolbar video stored (no poster, no
  // size, no duration). One path now, pinned here through the picker it opens.
  it('sends picked video files down the one insert path, with the kind spec accept', () => {
    const inputs: HTMLInputElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === 'input') inputs.push(el as HTMLInputElement);
      return el;
    });
    runWithTypedQuery('video', '/vid');
    const input = inputs[0];
    expect(input.accept).toBe('video/*');
    const clip = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(input, 'files', { value: [clip] });
    input.dispatchEvent(new Event('change'));
    expect(insertFiles).toHaveBeenCalledWith('video', editor, [clip], deps);
  });
});
