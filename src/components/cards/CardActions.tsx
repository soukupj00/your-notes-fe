import { useTranslation } from 'react-i18next';
import { LifecycleButtons } from '@/components/cards/LifecycleButtons.tsx';
import { NoteColorButton } from '@/components/color-picker/NoteColorButton.tsx';
import { icons } from '@/components/icons';
import { DeleteForeverDialog } from '@/components/notes/DeleteForeverDialog.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { useUndoableLifecycle } from '@/hooks/useUndoableLifecycle.ts';
import { noteControlButton } from '@/lib/note-controls.ts';
import type { Note } from '@/models.ts';

/**
 * Foot rail A (DESIGN.md, Card anatomy): always visible, and no `⋮` menu. Every action undoes
 * from its toast except Delete forever, which only a trashed Note offers and which asks first.
 */
export function CardActions({ note }: { note: Note }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { updateNote } = useNoteActions();
  const lifecycle = useUndoableLifecycle();

  // Shared with the editor's note bar so the two cannot drift.
  const railButton = noteControlButton(reducedMotion);

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      {/* A trashed Note is on its way out, so it is not recoloured. */}
      {note.state !== 'trashed' && (
        <NoteColorButton
          value={note.color}
          onChange={(color) => void updateNote(note.id, { color })}
          className={railButton}
        />
      )}
      <LifecycleButtons
        state={note.state}
        onArchive={() => lifecycle.archive(note.id)}
        onRestore={() => lifecycle.restore(note.id)}
        onTrash={() => lifecycle.trash(note.id)}
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
