import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NOTE_COLORS, noteColorStyle } from '@/lib/note-colors.ts';
import { cn } from '@/lib/utils.ts';

type NoteColorPickerProps = {
  /** The stored palette token, or undefined for "no colour". */
  value?: string;
  /** Called with the chosen token, or undefined when "no colour" is picked. */
  onChange: (color?: string) => void;
  className?: string;
};

/**
 * Swatch grid over the shared Note/Tag palette (`lib/note-colors.ts`). It deals
 * in palette *tokens*, not CSS values, so the same choice re-tints itself under
 * a different theme - which is why it is not the hex-based
 * `ColorPickerPanel` used for text colour inside the editor.
 */
export function NoteColorPicker({ value, onChange, className }: NoteColorPickerProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('grid grid-cols-5 gap-2', className)}>
      {NOTE_COLORS.map((token) => {
        const isNone = token === 'default';
        const selected = isNone ? !value : value === token;

        return (
          <button
            key={token}
            type="button"
            aria-label={t(`colors.${token}`)}
            aria-pressed={selected}
            onClick={() => onChange(isNone ? undefined : token)}
            style={noteColorStyle(token)}
            className={cn(
              'relative size-6 rounded-full border border-border transition-shadow',
              'hover:ring-2 hover:ring-ring/50 hover:ring-offset-1 hover:ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
            )}
          >
            {isNone && (
              /* Diagonal line: the conventional "no colour" swatch. */
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rotate-45 bg-destructive" />
            )}
            {selected && !isNone && (
              <Check className="absolute inset-0 m-auto size-4" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
