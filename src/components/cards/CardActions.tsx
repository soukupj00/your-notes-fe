import { Archive, ArchiveRestore, MoreVertical, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteColorPicker } from '@/components/color-picker/NoteColorPicker.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { cn } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface CardActionsProps {
  note: Note;
  onArchive: () => void;
  onRestore: () => void;
  onTrash: () => void;
  onPurge: () => void;
  onColorChange: (color?: string) => void;
}

/** Every rail control is the same icon button, so the row reads as one strip. */
const RAIL_BUTTON =
  'touch-target flex size-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * The card's foot rail (DESIGN.md → Card anatomy, "Foot rail (A)").
 *
 * The one lifecycle move for the note's current state, the colour swatch and
 * the `⋮` overflow, bottom-right. The strip is always visible so every action
 * is immediately discoverable and available on every input type.
 */
export function CardActions({
  note,
  onArchive,
  onRestore,
  onTrash,
  onPurge,
  onColorChange,
}: CardActionsProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  // A hover carries both a material change and a scale; the material is what
  // survives when the scale is switched off (DESIGN.md → Buttons).
  const railButton = cn(
    RAIL_BUTTON,
    !reducedMotion && 'transition-[background-color,color,box-shadow,transform] hover:scale-[1.06]'
  );

  return (
    <div data-slot="note-card-actions" className="ml-auto flex shrink-0 items-center gap-0.5">
      {note.state !== 'trashed' && (
        <button
          type="button"
          aria-label={t(note.state === 'archived' ? 'notes.restore' : 'notes.archive')}
          onClick={(e) => {
            e.stopPropagation();
            if (note.state === 'archived') onRestore();
            else onArchive();
          }}
          className={railButton}
        >
          {note.state === 'archived' ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
        </button>
      )}

      <Popover>
        <PopoverTrigger
          aria-label={t('notes.color')}
          onClick={(e) => e.stopPropagation()}
          className={railButton}
        >
          <Palette className="size-4" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
          <NoteColorPicker value={note.color} onChange={onColorChange} />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('notes.menu')}
          onClick={(e) => e.stopPropagation()}
          className={railButton}
        >
          <MoreVertical className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        {/* State-aware: a trashed note offers recovery and permanent deletion,
            everything else offers the move the rail does not already carry. */}
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {note.state === 'trashed' ? (
            <>
              <DropdownMenuItem onClick={onRestore}>{t('notes.restore')}</DropdownMenuItem>
              <DropdownMenuItem
                onClick={onPurge}
                className="text-destructive focus:text-destructive"
              >
                {t('notes.deleteForever')}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={onTrash} className="text-destructive focus:text-destructive">
              {t('notes.moveToTrash')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
