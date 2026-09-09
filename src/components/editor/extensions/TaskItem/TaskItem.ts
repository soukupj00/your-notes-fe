import { type TaskItemOptions, TaskItem as TiptapTaskItem } from '@tiptap/extension-list';
import { startTaskItemDrag } from './taskItemDrag';

export interface TaskItemExtensionOptions extends TaskItemOptions {
  /** Accessible name for the grip. Read at render time so the locale is live. */
  gripLabel: () => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskItem: {
      /**
       * Move the task item at `pos` so it becomes child `to` of its list, `to`
       * being counted after the item has been removed.
       */
      moveTaskItem: (attrs: { pos: number; to: number }) => ReturnType;
    };
  }
}

/** Lucide `grip-vertical`, inlined: this DOM is built by a node view, not React. */
const GRIP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>' +
  '<circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

/**
 * The upstream task item plus the two things a checklist needs to be reordered
 * by hand: a `moveTaskItem` command, and a grip in the editable node view that
 * drives it by pointer events (touch and mouse alike) or by arrow keys.
 *
 * The grip lives in the node view's DOM only. `renderHTML` is the upstream one,
 * so the stored Body and the Card's markup are unchanged, and the Card's
 * `.prose` rules never see a grip.
 */
export const TaskItem = TiptapTaskItem.extend<TaskItemExtensionOptions>({
  addOptions() {
    // The same cast `TaskList` makes: the parent's options are typed optional.
    return {
      ...this.parent?.(),
      gripLabel: () => 'Reorder',
    } as unknown as TaskItemExtensionOptions;
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
          let insertAt = listStart;
          const remaining = tr.doc.resolve(listStart).parent;
          for (let i = 0; i < to; i++) insertAt += remaining.child(i).nodeSize;
          tr.insert(insertAt, node);
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
      grip.setAttribute('aria-label', this.options.gripLabel());
      grip.innerHTML = GRIP_SVG;

      const move = (to: number) => {
        const pos = getPos();
        if (typeof pos === 'number') editor.commands.moveTaskItem({ pos, to });
      };
      grip.addEventListener('pointerdown', (event) => {
        startTaskItemDrag({ event, item, onDrop: move });
      });
      // The keyboard path, so a grip that can be focused can also be used.
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const pos = getPos();
        if (typeof pos !== 'number') return;
        const index = editor.state.doc.resolve(pos).index();
        move(event.key === 'ArrowUp' ? Math.max(0, index - 1) : index + 1);
        grip.focus();
      });

      item.prepend(grip);

      return {
        ...view,
        // The grip is ours, not the document's: ProseMirror must neither treat
        // its events as edits nor re-render the node when it changes. The same
        // goes for the row's own attributes - the drag writes a class and a
        // transform onto the `li`, and onto its neighbours for the drop marks,
        // and a node view rebuilt in answer to that would drop the row from
        // under the pointer mid-gesture.
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
