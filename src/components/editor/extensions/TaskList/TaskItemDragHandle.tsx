import type { Editor as TiptapEditor } from '@tiptap/core';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { GripVertical } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils.ts';

/**
 * The drag grip that reorders checklist items.
 *
 * TipTap's own drag-handle extension does the work: it follows the pointer, owns
 * the drop logic and knows how to move a nested node. Three things about how it
 * is configured here are deliberate.
 *
 * **`nested` is on, because a task item is never a top-level node** - it lives
 * inside its `taskList` - and the extension's default rules already resolve a
 * checklist to exactly the node we want: the wrapper list is excluded (its first
 * child is a `taskItem`) and so is the item's own content paragraph, leaving the
 * `taskItem` itself as the drag target.
 *
 * **Edge detection is off.** Its purpose is to let a pointer near the left edge
 * grab the *parent* container instead of the child, and its deduction is
 * `strength * depth` - at a task item's depth of 2 that reaches the exclusion
 * threshold, so a pointer travelling leftward toward the grip would knock out
 * the very node the grip is for. There is no parent here worth grabbing anyway.
 *
 * **Everything that is not a task item hides the grip** rather than being
 * excluded by a rule. An excluded node leaves the extension with no candidate at
 * all, and with no candidate it never calls `onNodeChange` - the grip would sit
 * frozen beside the last checklist it saw while the pointer moved on. Letting a
 * paragraph resolve normally and then hiding on it is what keeps the grip
 * checklist-only *and* honest about where the pointer is.
 *
 * Mouse-only by nature: the extension positions itself off `mousemove`, which a
 * touchscreen never fires. Reordering a checklist on a phone is not solved here.
 */
export function TaskItemDragHandle({ editor }: { editor: TiptapEditor }) {
  const [onTaskItem, setOnTaskItem] = useState(false);

  // Stable identity: the React wrapper re-registers its ProseMirror plugin
  // whenever this callback changes, so an inline arrow would tear the plugin
  // down and rebuild it on every render of the editor.
  const handleNodeChange = useCallback(({ node }: { node: ProseMirrorNode | null }) => {
    setOnTaskItem(node?.type.name === 'taskItem');
  }, []);

  return (
    <DragHandle
      editor={editor}
      nested={{ edgeDetection: 'none' }}
      onNodeChange={handleNodeChange}
      className={cn('task-drag-handle', !onTaskItem && 'task-drag-handle--off')}
    >
      {/* Decorative: the grip is a pointer affordance with no keyboard path, so
          it must not announce itself as one. */}
      <GripVertical className="size-4" aria-hidden="true" />
    </DragHandle>
  );
}
