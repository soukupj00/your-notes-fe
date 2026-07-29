import Color from 'color';
import { Check, Pipette } from 'lucide-react';
import { useRef, useState } from 'react';
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
            'hover:ring-2 hover:ring-ring/50 hover:ring-offset-1 hover:ring-offset-background',
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
  /** Commit: fired on a swatch click and when the custom picker drag is released. */
  onChange: (color: string) => void;
  /**
   * Transient preview: fired continuously while dragging the custom picker. When provided,
   * the drag no longer calls `onChange` on every move (only the final `onChange` on release)
   * - callers use this to show a live, uncommitted preview. When omitted, the custom picker
   * falls back to calling `onChange` on every move (live, immediate).
   */
  onPreview?: (color: string) => void;
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
  onPreview,
  palette,
  showCustom = true,
  className,
}: ColorPickerPanelProps) {
  const inPalette = palette.colors.some((c) => c.cssValue === value);
  const [customOpen, setCustomOpen] = useState(!inPalette && value !== '');

  // The custom picker previews into `draft` while dragging and commits on pointer release.
  // A ref mirrors `draft` so the pointer-up handler reads the latest value, not a stale closure.
  const [draft, setDraft] = useState(value || '#000000');
  const [syncedValue, setSyncedValue] = useState(value);
  const draftRef = useRef(draft);

  // Follow `value` when it changes from outside the picker (a swatch was clicked,
  // or the caller reset the colour). Adjusting state during render is React's
  // sanctioned alternative to a sync effect, which re-rendered twice per change.
  // `draftRef` is deliberately not touched here: it is only ever read on
  // pointer-up, and every pointer-up in the custom picker is preceded by a
  // `handlePickerChange` from the same gesture, so it cannot be stale there.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value || '#000000');
  }

  const handlePickerChange = (color: string) => {
    setDraft(color);
    draftRef.current = color;
    (onPreview ?? onChange)(color);
  };

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
            // Release (pointerup) commits the drafted color once; dragging only previews.
            <div onPointerUp={() => onChange(draftRef.current)}>
              <HexColorPicker color={draft} onChange={handlePickerChange} className="!w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ColorPickerPanel;
