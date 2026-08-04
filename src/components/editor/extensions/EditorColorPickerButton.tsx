import type { Editor } from '@tiptap/react';
import { Baseline, Highlighter, type LucideIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { ColorPickerPanel } from '@/components/color-picker/ColorPickerPanel';
import {
  type ColorPalette,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
} from '@/components/color-picker/palettes';
import {
  clearColorPreview,
  previewColor,
  setColorPicking,
} from '@/components/editor/extensions/color-preview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toggleVariants } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getShortcutKeys } from '@/utils/platform.ts';

export type EditorColorPickerVariant = 'text' | 'highlight';

interface EditorColorPickerButtonProps {
  editor: Editor;
  tooltip?: string;
  /** Keyboard shortcut hint, shown under the tooltip text. */
  shortcutKeys?: string[];
  variant: EditorColorPickerVariant;
}

type SelectionRange = { from: number; to: number; empty: boolean };

type VariantConfig = {
  attribute: 'color' | 'backgroundColor';
  icon: LucideIcon;
  palette: ColorPalette;
  previewProperty: 'color' | 'background-color';
};

const VARIANT_CONFIG: Record<EditorColorPickerVariant, VariantConfig> = {
  text: {
    attribute: 'color',
    icon: Baseline,
    palette: TEXT_COLORS,
    previewProperty: 'color',
  },
  highlight: {
    attribute: 'backgroundColor',
    icon: Highlighter,
    palette: HIGHLIGHT_COLORS,
    previewProperty: 'background-color',
  },
};

function clearStoredTextStyle(editor: Editor): void {
  if (!editor.state.storedMarks) return;

  const textStyleMark = editor.schema.marks.textStyle;
  if (textStyleMark) {
    editor.view.dispatch(editor.state.tr.removeStoredMark(textStyleMark));
  }
}

function commitColor(
  editor: Editor,
  variant: EditorColorPickerVariant,
  color: string,
  range: SelectionRange | null
): void {
  const hasSelection = range && !range.empty;
  if (!hasSelection) clearStoredTextStyle(editor);

  const chain = hasSelection
    ? editor.chain().setTextSelection({ from: range.from, to: range.to })
    : editor.chain().focus();

  if (variant === 'text') {
    if (color) chain.setColor(color).run();
    else chain.unsetColor().run();
    return;
  }

  if (color) chain.setBackgroundColor(color).run();
  else chain.unsetBackgroundColor().run();
}

/** Shared selection capture, live preview, and commit behavior for editor color marks. */
export function EditorColorPickerButton({
  editor,
  tooltip,
  shortcutKeys,
  variant,
}: EditorColorPickerButtonProps) {
  const config = VARIANT_CONFIG[variant];
  const currentColor: string = editor.getAttributes('textStyle')[config.attribute] || '';
  const rangeRef = useRef<SelectionRange | null>(null);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        const { from, to, empty } = editor.state.selection;
        rangeRef.current = { from, to, empty };
        setColorPicking(editor, true);
      } else {
        clearColorPreview(editor);
        setColorPicking(editor, false);
        rangeRef.current = null;
      }
    },
    [editor]
  );

  const handlePreview = useCallback(
    (color: string) => {
      const range = rangeRef.current;
      if (range && !range.empty) {
        previewColor(editor, {
          from: range.from,
          to: range.to,
          style: `${config.previewProperty}: ${color}`,
        });
      }
    },
    [config.previewProperty, editor]
  );

  const handleCommit = useCallback(
    (color: string) => {
      clearColorPreview(editor);
      commitColor(editor, variant, color, rangeRef.current);
    },
    [editor, variant]
  );

  const Icon = config.icon;

  return (
    <Popover onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            aria-label={tooltip}
            className={cn(
              toggleVariants({ size: 'sm' }),
              'flex h-8 w-8 items-center justify-center p-0',
              currentColor && 'bg-accent'
            )}
            style={{ color: currentColor || undefined }}
          >
            <Icon className="size-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="top" align="center">
            {/* Same two-line shape as `ActionButton`, so a custom-component
                button and a plain one describe themselves identically. */}
            <div className="flex max-w-[200px] flex-col items-center gap-1 text-center">
              <span>{tooltip}</span>
              {!!shortcutKeys?.length && (
                <span className="text-muted-foreground text-xs">
                  {getShortcutKeys(shortcutKeys)
                    .map((key) => key.symbol)
                    .join(' + ')}
                </span>
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent align="start" className="w-auto">
        <ColorPickerPanel
          palette={config.palette}
          value={currentColor}
          onChange={handleCommit}
          onPreview={handlePreview}
        />
      </PopoverContent>
    </Popover>
  );
}
