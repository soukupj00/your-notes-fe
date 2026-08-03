import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteColorPicker } from '@/components/color-picker/NoteColorPicker.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';

interface NoteColorButtonProps {
  /** The stored palette token, or undefined for "no colour". */
  value?: string;
  onChange: (color?: string) => void;
  /** The owning surface's icon-button style (see `lib/note-controls.ts`). */
  className?: string;
}

/**
 * The palette popover's trigger: one swatch grid reachable from every surface
 * that can recolour a note.
 *
 * It is a shared component rather than a repeated block because the grid it
 * opens carries accessibility affordances that must not exist on one mount and
 * not another - the per-swatch colour names, its own `TooltipProvider`, and the
 * 44px swatch box.
 */
export function NoteColorButton({ value, onChange, className }: NoteColorButtonProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('notes.color')}
        // Every mount sits inside a larger click target - the card is a
        // role="button" that opens the editor, and the dialog forwards stray
        // clicks into the body - so the trigger always keeps its click.
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        <Palette className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <NoteColorPicker value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
