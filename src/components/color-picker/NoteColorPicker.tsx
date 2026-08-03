import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx';
import { NOTE_COLORS, noteColorAttrs } from '@/lib/note-colors.ts';
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
    /*
     * The grid carries its own tooltip provider rather than relying on the app
     * root's. It mounts inside popovers and dialogs that are rendered standalone
     * in tests and could be reused anywhere; a swatch whose only label is a
     * tooltip must not lose that label because of where it was mounted. Radix
     * permits nesting, and the inner provider takes the same defaults.
     */
    <TooltipProvider>
      <div className={cn('grid grid-cols-5 gap-2', className)}>
        {NOTE_COLORS.map((token) => {
          const isNone = token === 'default';
          const selected = isNone ? !value : value === token;

          const label = t(`colors.${token}`);

          return (
            /*
             * The name is the palette's non-colour redundancy: a swatch grid where
             * identity is carried only by hue is unusable to anyone who cannot
             * separate those hues, and no palette - including the colour-blind one
             * - makes nine hues reliably separable. It is always on rather than
             * gated on the preference, because naming a colour you are about to
             * choose helps everyone and costs the grid nothing.
             */
            <Tooltip key={token}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => onChange(isNone ? undefined : token)}
                  {...noteColorAttrs(token)}
                  className={cn(
                    'relative size-11 rounded-full border border-note-swatch-ring bg-note-swatch transition-shadow',
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
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
