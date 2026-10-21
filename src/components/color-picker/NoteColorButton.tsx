import { Palette } from 'lucide-react';
import { useState } from 'react';
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
 * Shared rather than repeated, so the grid's accessibility (per-swatch names, its own
 * `TooltipProvider`, 44px swatches) is the same on every surface that recolours a note.
 */
export function NoteColorButton({ value, onChange, className }: NoteColorButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t('notes.color')}
        // Every mount sits inside a larger click target (the card opens the editor,
        // the dialog forwards stray clicks into the body), so the trigger keeps its click.
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        <Palette className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <NoteColorPicker value={value} onChange={onChange} onEscape={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
