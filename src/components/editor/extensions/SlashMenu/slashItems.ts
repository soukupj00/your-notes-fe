import type { Editor, Range } from '@tiptap/core';
import { getToolbarItem } from '@/components/editor/toolbar/registry';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import type { TFunction } from '../button-types';
import { insertImageAttachmentFiles } from '../Image/insert';

export interface SlashItem {
  /**
   * The **Toolbar Item id** this menu entry inserts (ADR 0011, decision 13).
   *
   * The registry owns the icon and the name; this file owns only what differs
   * per surface. That is why there is no `icon` or `labelKey` here: two lists
   * naming the same action were how the menu drifted from the bar in the first
   * place (Math was a toolbar button with no slash item at all).
   */
  key: string;
  /** Extra words the filter should match, so "bullet" finds "Bullet list". */
  keywords: string[];
  /**
   * `range` covers the typed `/query`; every item must consume it.
   *
   * This is the half that cannot be shared with the toolbar: a slash run has a
   * query to delete first, and a toolbar action must not delete anything.
   *
   * `t` is here for the one item that has to speak to the user before it can
   * act - Math prompts for LaTeX, and a hardcoded English prompt would be the
   * only untranslated string in the editor.
   */
  run: (ctx: { editor: Editor; range: Range; deps: AttachmentDeps; t: TFunction }) => void;
}

/** The registry's name for a slash item, which is the one both surfaces show. */
export function slashItemLabelKey(item: SlashItem): string {
  return getToolbarItem(item.key)?.labelKey ?? item.key;
}

/**
 * Open a throwaway file picker.
 *
 * The toolbar's media buttons own persistent hidden inputs, but a slash-menu
 * item has no element of its own to hang one on. Creating it inside the
 * activation keeps the user gesture alive, which is what `click()` needs.
 */
function pickFiles(accept: string, onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = true;
  input.addEventListener('change', () => {
    if (input.files?.length) onFiles(Array.from(input.files));
  });
  input.click();
}

/** Drop the typed `/query` before running a command, so it never survives. */
function consume(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range);
}

/**
 * Everything the slash menu can insert: blocks first (the common case), media
 * after. This is the keyboard-only counterpart to the toolbar, so the two lists
 * are meant to stay in step - an item added here should have a toolbar button
 * and vice versa.
 */
export const SLASH_ITEMS: SlashItem[] = [
  {
    key: 'h1',
    keywords: ['h1', 'title', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2',
    keywords: ['h2', 'subtitle', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    keywords: ['h3', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'bullet-list',
    keywords: ['bullet', 'unordered', 'ul'],
    run: ({ editor, range }) => consume(editor, range).toggleBulletList().run(),
  },
  {
    key: 'ordered-list',
    keywords: ['numbered', 'ordered', 'ol'],
    run: ({ editor, range }) => consume(editor, range).toggleOrderedList().run(),
  },
  {
    key: 'task-list',
    keywords: ['todo', 'checklist', 'checkbox'],
    run: ({ editor, range }) => consume(editor, range).toggleTaskList().run(),
  },
  {
    key: 'blockquote',
    keywords: ['quote', 'citation'],
    run: ({ editor, range }) => consume(editor, range).toggleBlockquote().run(),
  },
  {
    key: 'code-block',
    keywords: ['code', 'snippet', 'pre'],
    run: ({ editor, range }) => consume(editor, range).toggleCodeBlock().run(),
  },
  {
    key: 'divider',
    keywords: ['divider', 'separator', 'hr', 'rule'],
    run: ({ editor, range }) => consume(editor, range).setHorizontalRule().run(),
  },
  {
    key: 'image',
    keywords: ['picture', 'photo', 'img'],
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      pickFiles('image/*', (files) => {
        void insertImageAttachmentFiles(editor, files, deps, (id) =>
          editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
        );
      });
    },
  },
  {
    key: 'audio',
    keywords: ['recording', 'voice', 'mic'],
    // Recording is owned by the toolbar's mic button, reached through the same
    // storage coordinator the quick-capture speed-dial uses.
    run: ({ editor, range }) => {
      consume(editor, range).run();
      editor.storage.audioAttachment.capture.requestRecording();
    },
  },
  {
    key: 'video',
    keywords: ['movie', 'clip'],
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      pickFiles('video/*', (files) => {
        void insertAttachmentFiles(editor, files, 'video', deps, (id) =>
          editor.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
        );
      });
    },
  },
  {
    key: 'file',
    keywords: ['attachment', 'document', 'upload'],
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      pickFiles('', (files) => {
        void insertAttachmentFiles(editor, files, 'file', deps, (id) =>
          editor.chain().focus().insertFileAttachment({ attachmentId: id }).run()
        );
      });
    },
  },
  {
    // The drift this rewrite uncovered: `math` was a toolbar button with no way
    // to reach it from the keyboard at all.
    key: 'math',
    keywords: ['latex', 'formula', 'equation', 'tex'],
    run: ({ editor, range, t }) => {
      // The same prompt the toolbar button uses, so the two surfaces ask the
      // same question.
      const latex = window.prompt(t('editor.math.prompt'), '');
      if (!latex) return;
      consume(editor, range).insertInlineMath({ latex }).run();
    },
  },
  {
    key: 'drawing',
    keywords: ['sketch', 'excalidraw', 'draw', 'diagram'],
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      deps.openExcalidraw({});
    },
  },
];

/**
 * Filter the menu for a typed query. Matching is on the label *and* the
 * keywords, so `/bullet` finds "Bulleted list" and `/todo` finds "Checklist" -
 * a menu that only matched its own visible labels would make the user guess
 * our wording.
 */
export function filterSlashItems(
  query: string,
  t: (key: string) => string,
  items: SlashItem[] = SLASH_ITEMS
): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      t(slashItemLabelKey(item)).toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.includes(q))
  );
}
