import type { Editor, Range } from '@tiptap/core';
import type { IconName } from '@/components/icons';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import { insertImageAttachmentFiles } from '../Image/insert';

export interface SlashItem {
  /** Stable id: the filter key, the React key, and what tests assert on. */
  key: string;
  icon: IconName;
  /** i18n key for the visible label. */
  labelKey: string;
  /** Extra words the filter should match, so "bullet" finds "List". */
  keywords: string[];
  /** `range` covers the typed `/query`; every item must consume it. */
  run: (ctx: { editor: Editor; range: Range; deps: AttachmentDeps }) => void;
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
    key: 'heading1',
    icon: 'Heading1',
    labelKey: 'editor.slash.heading1',
    keywords: ['h1', 'title', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'heading2',
    icon: 'Heading2',
    labelKey: 'editor.slash.heading2',
    keywords: ['h2', 'subtitle', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'heading3',
    icon: 'Heading3',
    labelKey: 'editor.slash.heading3',
    keywords: ['h3', 'heading'],
    run: ({ editor, range }) => consume(editor, range).toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'bulletList',
    icon: 'List',
    labelKey: 'editor.slash.bulletList',
    keywords: ['bullet', 'unordered', 'ul'],
    run: ({ editor, range }) => consume(editor, range).toggleBulletList().run(),
  },
  {
    key: 'orderedList',
    icon: 'ListOrdered',
    labelKey: 'editor.slash.orderedList',
    keywords: ['numbered', 'ordered', 'ol'],
    run: ({ editor, range }) => consume(editor, range).toggleOrderedList().run(),
  },
  {
    key: 'taskList',
    icon: 'ListTodo',
    labelKey: 'editor.slash.taskList',
    keywords: ['todo', 'checklist', 'checkbox'],
    run: ({ editor, range }) => consume(editor, range).toggleTaskList().run(),
  },
  {
    key: 'blockquote',
    icon: 'Quote',
    labelKey: 'editor.slash.blockquote',
    keywords: ['quote', 'citation'],
    run: ({ editor, range }) => consume(editor, range).toggleBlockquote().run(),
  },
  {
    key: 'codeBlock',
    icon: 'Code2',
    labelKey: 'editor.slash.codeBlock',
    keywords: ['code', 'snippet', 'pre'],
    run: ({ editor, range }) => consume(editor, range).toggleCodeBlock().run(),
  },
  {
    key: 'horizontalRule',
    icon: 'Minus',
    labelKey: 'editor.slash.horizontalRule',
    keywords: ['divider', 'separator', 'hr', 'rule'],
    run: ({ editor, range }) => consume(editor, range).setHorizontalRule().run(),
  },
  {
    key: 'image',
    icon: 'ImagePlus',
    labelKey: 'editor.slash.image',
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
    icon: 'Mic',
    labelKey: 'editor.slash.audio',
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
    icon: 'FileVideo',
    labelKey: 'editor.slash.video',
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
    icon: 'Paperclip',
    labelKey: 'editor.slash.file',
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
    key: 'drawing',
    icon: 'PenTool',
    labelKey: 'editor.slash.drawing',
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
      t(item.labelKey).toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.includes(q))
  );
}
