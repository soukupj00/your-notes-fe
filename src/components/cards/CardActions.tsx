import { Archive, ArchiveRestore, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
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
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  // Shared with the editor's note bar so the two cannot drift.
  const railButton = noteControlButton(reducedMotion);

  // Both leave through `restoreToActive`, but un-archiving and un-trashing are different
  // gestures, so each has its own icon.
  const isActive = note.state === 'active';
  const LeaveIcon = isActive ? Archive : note.state === 'archived' ? ArchiveRestore : RotateCcw;

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      <NoteColorButton value={note.color} onChange={onColorChange} className={railButton} />

      <IconTooltip label={t(isActive ? 'notes.archive' : 'notes.restore')}>
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
      </IconTooltip>

      {note.state !== 'trashed' && (
        <IconTooltip label={t('notes.moveToTrash')}>
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
        </IconTooltip>
      )}
    </div>
  );
}
