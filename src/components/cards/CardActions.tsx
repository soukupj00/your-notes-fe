import { LifecycleButtons } from '@/components/cards/LifecycleButtons.tsx';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { noteControlButton } from '@/lib/note-controls.ts';
import type { Note } from '@/models.ts';

interface CardActionsProps {
  note: Note;
  onArchive: () => void;
  onRestore: () => void;
  onTrash: () => void;
  onColorChange: (color?: string) => void;
}

/**
 * Foot rail A (DESIGN.md, Card anatomy): always visible, and no `⋮` menu because every action
 * here is undoable from its toast. Permanent delete is deliberately absent: the trash is the
 * confirmation, emptied explicitly from `/trash`.
 */
export function CardActions({
  note,
  onArchive,
  onRestore,
  onTrash,
  onColorChange,
}: CardActionsProps) {
  const reducedMotion = useReducedMotion();

  // Shared with the editor's note bar so the two cannot drift.
  const railButton = noteControlButton(reducedMotion);

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      {/* A trashed Note is on its way out, so it is not recoloured (FEEDBACK U8). */}
      {note.state !== 'trashed' && (
        <NoteColorButton value={note.color} onChange={onColorChange} className={railButton} />
      )}
      <LifecycleButtons
        state={note.state}
        onArchive={onArchive}
        onRestore={onRestore}
        onTrash={onTrash}
        className={railButton}
      />
    </div>
  );
}
