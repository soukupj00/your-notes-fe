import type { Editor, Range } from '@tiptap/core';
import { getToolbarItem } from '@/components/editor/toolbar/registry';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { insertFiles } from '../attachments/insert';
import type { TFunction } from '../button-types';

export interface SlashItem {
  /** The Toolbar Item id (ADR 0011, decision 13). Icon and name come from the registry,
   *  so the menu cannot drift from the bar. */
  key: string;
  /** Extra words the filter should match, so "bullet" finds "Bullet list". */
  keywords: string[];
  /** Must delete the typed `/query` (`range`) first, which is why it is not shared
   *  with the toolbar action. `t` is for Math's LaTeX prompt. */
  run: (ctx: { editor: Editor; range: Range; deps: AttachmentDeps; t: TFunction }) => void;
}

export function slashItemLabelKey(item: SlashItem): string {
  return getToolbarItem(item.key)?.labelKey ?? item.key;
}

/** A throwaway input, because a slash item has no element to own one. It is created
 *  inside the user's activation, which `click()` needs. */
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

/** A slash item that picks files for a kind: the same path as the kind's toolbar button. */
function pickerItem(kind: AttachmentKind, keywords: string[]): SlashItem {
  return {
    key: kind,
    keywords,
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      pickFiles(ATTACHMENT_SPECS[kind].accept ?? '', (files) => {
        void insertFiles(kind, editor, files, deps);
      });
    },
  };
}

/** Blocks first, media after. Every item should have a toolbar button and vice versa. */
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
  pickerItem('image', ['picture', 'photo', 'img']),
  {
    key: 'audio',
    keywords: ['recording', 'voice', 'mic'],
    // Asks AudioRecorderHost to start, the same way the quick-capture dial does.
    run: ({ editor, range }) => {
      consume(editor, range).run();
      editor.storage.audioAttachment.capture.requestRecording();
    },
  },
  pickerItem('video', ['movie', 'clip']),
  pickerItem('file', ['attachment', 'document', 'upload']),
  {
    key: 'math',
    keywords: ['latex', 'formula', 'equation', 'tex'],
    run: ({ editor, range, t }) => {
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

/** Matches keywords as well as the label, so `/todo` finds "Checklist" and the user
 *  never has to guess our wording. */
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
