import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskItem } from './TaskItem';

const item = (label: string, checked = false) =>
  `<li data-type="taskItem" data-checked="${checked}"><p>${label}</p></li>`;
const list = (...items: string[]) => `<ul data-type="taskList">${items.join('')}</ul>`;

/** Labels in stored order, which is what the command changes. */
function labels(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') out.push(node.textContent);
  });
  return out;
}

/** Document position of the nth task item. */
function posOf(editor: Editor, index: number): number {
  let n = 0;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === 'taskItem') {
      if (n === index) found = pos;
      n++;
    }
  });
  return found;
}

describe('TaskItem extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: list(item('A'), item('B', true), item('C')),
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('moveTaskItem moves an item down to the given index', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 2 })).toBe(true);
    expect(labels(editor)).toEqual(['B', 'C', 'A']);
  });

  it('moveTaskItem moves an item up to the given index', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 2), to: 0 })).toBe(true);
    expect(labels(editor)).toEqual(['C', 'A', 'B']);
  });

  it('keeps the checked state of the moved item', () => {
    editor.commands.moveTaskItem({ pos: posOf(editor, 1), to: 0 });
    // The first `<li>` in the stored markup is the checked one.
    expect(editor.getHTML()).toMatch(/^<ul data-type="taskList"><li [^>]*data-checked="true"/);
  });

  it('is one undo step', () => {
    // History is not registered here; the command must be a single transaction
    // so that when it is, one Undo puts the item back.
    let transactions = 0;
    editor.on('transaction', () => {
      transactions += 1;
    });
    editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 2 });
    expect(transactions).toBe(1);
  });

  it('refuses a position that is not a task item', () => {
    expect(editor.commands.moveTaskItem({ pos: 0, to: 1 })).toBe(false);
    expect(labels(editor)).toEqual(['A', 'B', 'C']);
  });

  it('refuses an index outside the list', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 3 })).toBe(false);
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: -1 })).toBe(false);
  });

  it('keeps the row element through a drag: the class it writes is not an edit', async () => {
    // ProseMirror rebuilds a node view whose DOM mutated unless the view says
    // to ignore it. The drag writes a class onto the `li`; a rebuild there
    // would replace the very element the pointer is holding.
    const mounted = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: list(item('A'), item('B')),
    });
    try {
      const row = mounted.view.dom.querySelector('li') as HTMLElement;
      const grip = row.querySelector('.task-item-grip') as HTMLElement;
      expect(grip).not.toBeNull();

      grip.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse' })
      );
      // Mutation observers report asynchronously.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(row.isConnected).toBe(true);
      expect(row.classList.contains('task-item-dragging')).toBe(true);
    } finally {
      mounted.destroy();
    }
  });

  it("keeps focus on the moved row's grip, so the arrows can keep moving it", () => {
    const mounted = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: list(item('A'), item('B'), item('C')),
    });
    try {
      const focusedRow = () => document.activeElement?.closest('li')?.textContent;
      (mounted.view.dom.querySelector('.task-item-grip') as HTMLElement).focus();

      for (const _ of [1, 2]) {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
      }

      expect(labels(mounted)).toEqual(['B', 'C', 'A']);
      expect(focusedRow()).toBe('A');
    } finally {
      mounted.destroy();
    }
  });

  describe('the grip for assistive tech', () => {
    // Shows the key and its values, so a test sees what was interpolated.
    const t = (key: string, opts?: Record<string, unknown>) =>
      [key, ...Object.values(opts ?? {})].join(' ');
    let mounted: Editor;
    const grips = () =>
      [...mounted.view.dom.querySelectorAll<HTMLElement>('.task-item-grip')].map((grip) => [
        grip.getAttribute('aria-label'),
        document.getElementById(grip.getAttribute('aria-describedby') ?? '')?.textContent,
      ]);
    const status = () => mounted.view.dom.parentElement?.querySelector('[role="status"]');

    beforeEach(() => {
      mounted = new Editor({
        element: document.body.appendChild(document.createElement('div')),
        extensions: [Document, Paragraph, Text, TaskList, TaskItem.configure({ t })],
        content: list(item('A'), item('')),
      });
    });

    afterEach(() => {
      mounted.destroy();
    });

    it('names each grip by its row and says which keys move it', () => {
      expect(grips()).toEqual([
        ['dnd.handle A', 'editor.taskItem.gripKeys'],
        ['dnd.handle editor.taskItem.empty', 'editor.taskItem.gripKeys'],
      ]);
    });

    it('renames the grip as its row is edited', () => {
      mounted.commands.insertContentAt(posOf(mounted, 0) + 2, 'B');

      expect(grips()[0][0]).toBe('dnd.handle BA');
    });

    it('announces where a keyboard move landed, once, in one status node', () => {
      expect(status()?.textContent).toBe('');

      mounted.view.dom.querySelector<HTMLElement>('.task-item-grip')?.focus();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      expect(status()?.textContent).toBe('dnd.over A 2');
      expect(mounted.view.dom.parentElement?.querySelectorAll('[role="status"]')).toHaveLength(1);
    });

    it('names the row by its words at the press, after an edit', () => {
      mounted.commands.insertContentAt(posOf(mounted, 0) + 2, 'B');

      mounted.view.dom.querySelector<HTMLElement>('.task-item-grip')?.focus();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      expect(status()?.textContent).toBe('dnd.over BA 2');
    });

    it('says a repeated move again, though its words are the same', () => {
      mounted.commands.setContent(list(item(''), item(''), item('')));
      const pressDown = (row: number) => {
        mounted.view.dom.querySelectorAll<HTMLElement>('.task-item-grip')[row].focus();
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
        return status()?.textContent;
      };

      const first = pressDown(0);
      const second = pressDown(0);

      expect(first?.trim()).toBe('dnd.over editor.taskItem.empty 2');
      expect(second?.trim()).toBe(first?.trim());
      expect(second).not.toBe(first);
    });

    it('says nothing when the row is already at the top', () => {
      mounted.view.dom.querySelector<HTMLElement>('.task-item-grip')?.focus();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      );

      expect(status()?.textContent).toBe('');
    });
  });

  it('serialises no grip: the stored Body is the same markup as before', () => {
    expect(editor.getHTML()).not.toContain('button');
    expect(editor.getHTML()).not.toContain('grip');
  });
});
