import type { Editor } from '@tiptap/react';
import { Baseline } from 'lucide-react';
import { useCallback } from 'react';
import { ColorPickerPanel } from '@/components/color-picker/ColorPickerPanel';
import { TEXT_COLORS } from '@/components/color-picker/palettes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toggleVariants } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TextColorButtonProps {
  editor: Editor;
  tooltip?: string;
}

/**
 * Toolbar trigger for the editor text color (Pattern A custom component, like
 * `HeadingDropdown`). A toggle-styled button whose `Baseline` glyph is tinted to the
 * current color opens a `Popover` containing the shared `ColorPickerPanel`. The button
 * is rendered by `PopoverTrigger` itself (single `asChild` under `TooltipTrigger`) to
 * avoid the nested-asChild pitfall; `data-state` is owned by Radix (open/closed), so
 * the active tint/highlight is applied via style + class.
 */
export function TextColorButton({ editor, tooltip }: TextColorButtonProps) {
  const currentColor: string = editor.getAttributes('textStyle').color || '';

  const handleColorChange = useCallback(
    (newColor: string) => {
      // Clear any pending stored textStyle mark so the new color replaces it at a
      // collapsed cursor (workaround carried over from the previous picker).
      if (editor.state.storedMarks) {
        const textStyleMark = editor.schema.marks.textStyle;
        if (textStyleMark) {
          editor.view.dispatch(editor.state.tr.removeStoredMark(textStyleMark));
        }
      }
      if (newColor) {
        editor.chain().focus().setColor(newColor).run();
      } else {
        editor.chain().focus().unsetColor().run();
      }
    },
    [editor]
  );

  return (
    <Popover>
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
            <Baseline className="size-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="top" align="center">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent align="start" className="w-auto">
        <ColorPickerPanel palette={TEXT_COLORS} value={currentColor} onChange={handleColorChange} />
      </PopoverContent>
    </Popover>
  );
}

export default TextColorButton;
