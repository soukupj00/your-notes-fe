import { useTranslation } from 'react-i18next';
import { LifecycleButtons } from '@/components/cards/LifecycleButtons.tsx';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { icons } from '@/components/icons';
import { DeleteForeverDialog } from '@/components/notes/DeleteForeverDialog.tsx';
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
 * Foot rail A (DESIGN.md, Card anatomy): always visible, and no `⋮` menu. Every action undoes
 * from its toast except Delete forever, which only a trashed Note offers and which asks first.
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

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      {/* A trashed Note is on its way out, so it is not recoloured. */}
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
      {note.state === 'trashed' && (
        <DeleteForeverDialog noteId={note.id}>
          <IconTooltip label={t('notes.deleteForever')}>
            <button
              type="button"
              aria-label={t('notes.deleteForever')}
              onClick={(e) => e.stopPropagation()}
              className={railButton}
            >
              <icons.TrashX className="size-4" aria-hidden />
            </button>
          </IconTooltip>
        </DeleteForeverDialog>
      )}
    </div>
  );
}
