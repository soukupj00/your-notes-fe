import Color from 'color';
import { Check, Pipette } from 'lucide-react';
import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ColorItem, ColorPalette } from './palettes';

/** Black or white, whichever reads better on the given color. Guards invalid/partial
 * hex (mid-typing in the custom picker) and non-hex css tokens. */
function contrastColor(css: string): string {
  try {
    return Color(css).isDark() ? '#ffffff' : '#000000';
  } catch {
    return '#000000';
  }
}

interface SwatchProps {
  color: ColorItem;
  selected: boolean;
  onSelect: (cssValue: string) => void;
}

function Swatch({ color, selected, onSelect }: SwatchProps) {
  const isDefault = color.cssValue === '';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={color.label}
          aria-pressed={selected}
          onClick={() => onSelect(color.cssValue)}
          className={cn(
            'relative size-6 overflow-hidden rounded-md border border-border transition-shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
          )}
          style={isDefault ? undefined : { backgroundColor: color.cssValue }}
        >
          {isDefault && (
            /* Diagonal line indicating "no color". */
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rotate-45 bg-destructive" />
          )}
          {selected && !isDefault && (
            <Check
              className="absolute inset-0 m-auto size-4"
              style={{ color: contrastColor(color.cssValue) }}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{color.label}</TooltipContent>
    </Tooltip>
  );
}

export interface ColorPickerPanelProps {
  /** Current color (hex/css). Empty string means none/default. */
  value: string;
  /** Fired on swatch click and on every change from the custom picker. */
  onChange: (color: string) => void;
  palette: ColorPalette;
  /** Enable the "Custom" full-picker reveal (default true). */
  showCustom?: boolean;
  className?: string;
}

/**
 * Unified, trigger-agnostic color picker: a grid of preset swatches (always shown)
 * plus a "Custom" toggle that reveals a full react-colorful hex picker. Same markup
 * on mobile and desktop. Callers supply their own palette and wrap it in whatever
 * trigger (Popover / Dialog) suits the site.
 */
export function ColorPickerPanel({
  value,
  onChange,
  palette,
  showCustom = true,
  className,
}: ColorPickerPanelProps) {
  const inPalette = palette.colors.some((c) => c.cssValue === value);
  const [customOpen, setCustomOpen] = useState(!inPalette && value !== '');

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid grid-cols-4 gap-2">
        {palette.colors.map((color) => (
          <Swatch
            key={color.cssValue || 'default'}
            color={color}
            selected={value === color.cssValue}
            onSelect={onChange}
          />
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={customOpen}
            className="h-8 justify-start gap-2 px-2"
            onClick={() => setCustomOpen((open) => !open)}
          >
            <Pipette className="size-4" />
            Custom
          </Button>
          {customOpen && (
            <HexColorPicker color={value || '#000000'} onChange={onChange} className="!w-full" />
          )}
        </div>
      )}
    </div>
  );
}

export default ColorPickerPanel;
