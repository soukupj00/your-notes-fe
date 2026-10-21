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
  onChange: (color?: string) => void;
  /** A focused swatch's tooltip is the topmost layer, so it hears Escape before the popover does. */
  onEscape?: () => void;
  className?: string;
};

/**
 * Deals in palette tokens, not CSS values, so a choice re-tints itself under another
 * theme; that is why it is not the hex-based `ColorPickerPanel`.
 */
export function NoteColorPicker({ value, onChange, onEscape, className }: NoteColorPickerProps) {
  const { t } = useTranslation();

  return (
    // Its own provider: a swatch whose only visible label is a tooltip must keep it
    // wherever it mounts, standalone tests included. Radix permits nesting.
    <TooltipProvider>
      <div className={cn('grid grid-cols-5 gap-2', className)}>
        {NOTE_COLORS.map((token) => {
          const isNone = token === 'default';
          const selected = isNone ? !value : value === token;

          const label = t(`colors.${token}`);

          return (
            // The name is the palette's non-colour redundancy: no palette, the colour-blind
            // one included, makes nine hues reliably separable. Always on, not gated on
            // the preference, because a name helps everyone.
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
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rotate-45 bg-destructive" />
                  )}
                  {selected && !isNone && (
                    <Check className="absolute inset-0 m-auto size-4" aria-hidden />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent onEscapeKeyDown={onEscape}>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
