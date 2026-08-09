import {
  type Announcements,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { cn } from '@/lib/utils.ts';

interface SortableListProps {
  /** Every row's id, in current order. Also what the announcements count against. */
  ids: string[];
  /** Called with the dragged row and the row it was dropped onto. */
  onReorder: (activeId: string, overId: string) => void;
  /** Human name of a row, for the screen-reader announcements. */
  nameOf: (id: string) => string;
  children: ReactNode;
}

/**
 * A keyboard-operable, drag-reorderable vertical list.
 *
 * Order is user data here, not decoration, so the keyboard sensor is not
 * optional and there are deliberately **no** parallel up/down buttons: two ways
 * to reorder is two things to keep in step, and the keyboard sensor already
 * makes the drag handle a real control (Space to lift, arrows to move, Space to
 * drop) rather than a mouse-only affordance.
 */
export function SortableList({ ids, onReorder, nameOf, children }: SortableListProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    // A few pixels of slop, so a tap on the handle can still be a tap - on touch
    // an immediate activation makes the row impossible to scroll past.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const position = (id: string) => ids.indexOf(id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('dnd.lifted', { name: nameOf(String(active.id)), position: position(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('dnd.over', { name: nameOf(String(active.id)), position: position(String(over.id)) })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('dnd.dropped', { name: nameOf(String(active.id)), position: position(String(over.id)) })
        : t('dnd.cancelled', { name: nameOf(String(active.id)) }),
    onDragCancel: ({ active }) => t('dnd.cancelled', { name: nameOf(String(active.id)) }),
  };
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t('dnd.instructions'),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  /** Accessible name of the handle - it is the control, so it carries the name. */
  handleLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * One row: a drag handle plus whatever the list puts in it.
 *
 * The handle is the **only** drag origin. These rows carry switches, menus and
 * a drill-in target, and a row that drags from anywhere would swallow the first
 * few pixels of every one of those gestures.
 */
export function SortableRow({ id, handleLabel, className, children }: SortableRowProps) {
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    // `null` opts out of dnd-kit's own reflow animation; the row still moves,
    // it just arrives rather than slides.
    transition: reducedMotion ? null : undefined,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      data-dragging={isDragging || undefined}
      className={cn(
        'flex min-h-11 items-center gap-1 bg-card px-2',
        // Lifted out of the flow of its neighbours while it is being carried.
        isDragging && 'relative z-10 rounded-md shadow-lift',
        className
      )}
    >
      <button
        type="button"
        aria-label={handleLabel}
        // `touch-none` is required rather than cosmetic: without it the browser
        // claims the gesture for scrolling and the pointer sensor never fires.
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {children}
    </div>
  );
}
