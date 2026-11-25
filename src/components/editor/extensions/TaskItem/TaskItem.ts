import { type TaskItemOptions, TaskItem as TiptapTaskItem } from '@tiptap/extension-list';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { TFunction } from '../button-types';
import { startTaskItemDrag } from './taskItemDrag';

export interface TaskItemExtensionOptions extends TaskItemOptions {
  /** Called per use, so the grip's words follow the live locale. */
  t: TFunction;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskItem: {
      /** `to` is the child index counted after the item has been removed. */
      moveTaskItem: (attrs: { pos: number; to: number }) => ReturnType;
    };
  }
}

/** Lucide `grip-vertical`, inlined: this DOM is built by a node view, not React. */
const GRIP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>' +
  '<circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

/** A row's accessible name: its words, or a stand-in, since an empty name says nothing. */
export function taskItemName(node: ProseMirrorNode, t: TFunction): string {
  return node.textBetween(0, node.content.size, ' ').trim() || t('editor.taskItem.empty');
}

const STATUS_ATTR = 'data-task-item-status';
let editors = 0;

interface TaskItemStorage {
  /** The id of the grips' shared key hint, which their `aria-describedby` points at. */
  keysHintId: string;
}

/** One polite region beside the editor, which a keyboard move speaks through. */
function statusOf(view: EditorView): HTMLElement | null {
  return view.dom.parentElement?.querySelector<HTMLElement>(`:scope > [${STATUS_ATTR}]`) ?? null;
}

/** Document position of a list's `index`th child, the list's content starting at `start`. */
function childPos(list: ProseMirrorNode, start: number, index: number): number {
  let pos = start;
  for (let i = 0; i < index; i++) pos += list.child(i).nodeSize;
  return pos;
}

/** Adds `moveTaskItem` and a reorder grip driven by pointer or arrow keys. The grip lives
 *  only in the editable node view; `renderHTML` stays upstream's, so the stored Body and
 *  the Card never carry it. */
export const TaskItem = TiptapTaskItem.extend<TaskItemExtensionOptions, TaskItemStorage>({
  addOptions() {
    // The same cast `TaskList` makes: the parent's options are typed optional.
    return {
      ...this.parent?.(),
      t: (key: string) => key,
    } as unknown as TaskItemExtensionOptions;
  },

  addStorage() {
    editors += 1;
    return { keysHintId: `task-item-keys-${editors}` };
  },

  addProseMirrorPlugins() {
    const { t } = this.options;
    const { keysHintId } = this.storage;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        view: (view) => {
          const status = document.createElement('div');
          status.setAttribute(STATUS_ATTR, '');
          status.setAttribute('role', 'status');
          status.className = 'sr-only';
          const keysHint = document.createElement('div');
          keysHint.id = keysHintId;
          keysHint.hidden = true;
          keysHint.textContent = t('editor.taskItem.gripKeys');
          view.dom.after(status, keysHint);
          return {
            destroy: () => {
              status.remove();
              keysHint.remove();
            },
          };
        },
      }),
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      moveTaskItem:
        ({ pos, to }) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          const $pos = tr.doc.resolve(pos);
          const list = $pos.parent;
          if (to < 0 || to > list.childCount - 1) return false;
          const from = $pos.index();
          if (from === to) return true;
          if (!dispatch) return true;

          const listStart = $pos.start();
          tr.delete(pos, pos + node.nodeSize);
          // Offsets in the list after the removal.
          tr.insert(childPos(tr.doc.resolve(listStart).parent, listStart, to), node);
          return true;
        },
    };
  },

  addNodeView() {
    const parent = this.parent?.();
    if (!parent) return null;
    return (props) => {
      const view = parent(props);
      const { editor, getPos } = props;
      if (!editor.isEditable || typeof getPos !== 'function' || !('dom' in view)) return view;

      const item = view.dom as HTMLElement;
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'task-item-grip';
      grip.contentEditable = 'false';
      const { t } = this.options;
      const nameGrip = (node: ProseMirrorNode) =>
        grip.setAttribute('aria-label', t('dnd.handle', { name: taskItemName(node, t) }));
      nameGrip(props.node);
      grip.setAttribute('aria-describedby', this.storage.keysHintId);
      grip.innerHTML = GRIP_SVG;

      const move = (to: number) => {
        const pos = getPos();
        if (typeof pos === 'number') editor.commands.moveTaskItem({ pos, to });
      };
      grip.addEventListener('pointerdown', (event) => {
        startTaskItemDrag({ event, item, onDrop: move });
      });
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const pos = getPos();
        if (typeof pos !== 'number') return;
        const $pos = editor.state.doc.resolve(pos);
        const to = $pos.index() + (event.key === 'ArrowUp' ? -1 : 1);
        const row = editor.state.doc.nodeAt(pos);
        if (!row || to < 0 || !editor.commands.moveTaskItem({ pos, to })) return;
        // The move rebuilds the row's node view, so focus follows to the new row's grip.
        const listStart = $pos.start();
        const moved = editor.view.nodeDOM(
          childPos(editor.state.doc.resolve(listStart).parent, listStart, to)
        );
        if (moved instanceof HTMLElement)
          moved.querySelector<HTMLElement>('.task-item-grip')?.focus();
        const status = statusOf(editor.view);
        if (!status) return;
        const message = t('dnd.over', { name: taskItemName(row, t), position: to + 1 });
        // A live region speaks only a change, so a repeat gets an invisible difference.
        status.textContent = status.textContent === message ? `${message}\u00A0` : message;
      });

      item.prepend(grip);

      return {
        ...view,
        update: (node, decorations, innerDecorations) => {
          const kept = view.update?.(node, decorations, innerDecorations) ?? false;
          if (kept) nameGrip(node);
          return kept;
        },
        // The grip is ours, not the document's. Row attribute changes are not edits either:
        // the drag writes a class and transform onto each `li`, and a rebuilt node view
        // would drop the row from under the pointer.
        stopEvent: (event: Event) =>
          grip.contains(event.target as Node) || (view.stopEvent?.(event) ?? false),
        ignoreMutation: (mutation) =>
          (mutation.type === 'attributes' && mutation.target === item) ||
          grip.contains(mutation.target) ||
          (view.ignoreMutation?.(mutation) ?? false),
      };
    };
  },
});
