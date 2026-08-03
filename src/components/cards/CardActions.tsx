import { Archive, ArchiveRestore, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
 * The card's foot rail (DESIGN.md → Card anatomy, "Foot rail (A)").
 *
 * Every control is a direct icon: the note's one lifecycle move *out* of its
 * current state, the move *down* to the trash where one exists, and the colour
 * swatch. The strip is always visible so every action is immediately
 * discoverable and available on every input type.
 *
 * There is no `⋮`. An overflow menu that holds a single item is a click in
 * front of a button, and the actions here are all recoverable through the undo
 * toast the card offers on every transition - so none of them needs the extra
 * step a menu implies.
 *
 * Permanent deletion is deliberately *not* here. The trash is the confirmation:
 * a note sits there until it expires or the user empties it from `/trash`, and
 * a one-click purge on a card in a wall is a different risk from an explicit
 * "empty the trash".
 */
export function CardActions({
  note,
  onArchive,
  onRestore,
  onTrash,
  onColorChange,
}: CardActionsProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  // The same icon button the editor's note bar uses, so the two surfaces
  // cannot drift apart (`lib/note-controls.ts`).
  const railButton = noteControlButton(reducedMotion);

  // Archived and trashed both leave by the same door (`restoreToActive`) but
  // read as different moves, so each takes its own icon: putting a note back on
  // the desk is not the same gesture as pulling it out of the bin.
  const isActive = note.state === 'active';
  const LeaveIcon = isActive ? Archive : note.state === 'archived' ? ArchiveRestore : RotateCcw;

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      <NoteColorButton value={note.color} onChange={onColorChange} className={railButton} />

      <button
        type="button"
        aria-label={t(isActive ? 'notes.archive' : 'notes.restore')}
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) onArchive();
          else onRestore();
        }}
        className={railButton}
      >
        <LeaveIcon className="size-4" aria-hidden />
      </button>

      {/* Trashing something already in the trash is meaningless. */}
      {note.state !== 'trashed' && (
        <button
          type="button"
          aria-label={t('notes.moveToTrash')}
          onClick={(e) => {
            e.stopPropagation();
            onTrash();
          }}
          className={railButton}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
