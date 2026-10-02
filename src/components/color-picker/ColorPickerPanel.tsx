import Color from 'color';
import { Check, Pipette } from 'lucide-react';
import { useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ColorItem, ColorPalette } from './palettes';

/** Black or white, whichever reads better. Tolerates partial hex mid-typing and CSS tokens. */
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
  /** Empty string means none (the default). */
  value: string;
  /** Commit: fired on a swatch click and when the custom picker drag is released. */
  onChange: (color: string) => void;
  /**
   * Fired while dragging the custom picker; when given, `onChange` fires only on release.
   * Omitted, every move calls `onChange`.
   */
  onPreview?: (color: string) => void;
  palette: ColorPalette;
  showCustom?: boolean;
  className?: string;
}

/** Trigger-agnostic: callers supply the palette and wrap it in their own Popover or Dialog. */
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

  // Follows an outside `value` by adjusting state during render; a sync effect rendered
  // twice per change. `draftRef` is left alone: every pointer-up follows a
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
