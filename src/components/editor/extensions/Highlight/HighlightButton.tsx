import type { Editor } from '@tiptap/react';
import { Highlighter } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { ColorPickerPanel } from '@/components/color-picker/ColorPickerPanel';
import { HIGHLIGHT_COLORS } from '@/components/color-picker/palettes';
import {
  clearColorPreview,
  previewColor,
  setColorPicking,
} from '@/components/editor/extensions/color-preview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toggleVariants } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HighlightButtonProps {
  editor: Editor;
  tooltip?: string;
}

/** The selection to highlight, captured when the popover opens (the editor blurs but keeps it). */
type Range = { from: number; to: number; empty: boolean };

/**
 * Toolbar trigger for the editor text highlight (Pattern A custom component, mirrors
 * `TextColorButton`). Dragging the custom picker previews the highlight live on the
 * selected text via a ProseMirror decoration (see `color-preview.ts`) without committing;
 * the real `setBackgroundColor` mark is applied only on release / swatch click.
 */
export function HighlightButton({ editor, tooltip }: HighlightButtonProps) {
  const currentColor: string = editor.getAttributes('textStyle').backgroundColor || '';
  const rangeRef = useRef<Range | null>(null);

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
          style: `background-color: ${color}`,
        });
      }
    },
    [editor]
  );

  const handleCommit = useCallback(
    (newColor: string) => {
      clearColorPreview(editor);
      const range = rangeRef.current;

      // Collapsed cursor: apply as a stored mark so subsequent typing is highlighted.
      if (!range || range.empty) {
        if (editor.state.storedMarks) {
          const textStyleMark = editor.schema.marks.textStyle;
          if (textStyleMark) {
            editor.view.dispatch(editor.state.tr.removeStoredMark(textStyleMark));
          }
        }
        if (newColor) {
          editor.chain().focus().setBackgroundColor(newColor).run();
        } else {
          editor.chain().focus().unsetBackgroundColor().run();
        }
        return;
      }

      // Range selection: apply to the stored range without focusing, so the popover stays open.
      const chain = editor.chain().setTextSelection({ from: range.from, to: range.to });
      if (newColor) {
        chain.setBackgroundColor(newColor).run();
      } else {
        chain.unsetBackgroundColor().run();
      }
    },
    [editor]
  );

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
            <Highlighter className="size-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="top" align="center">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent align="start" className="w-auto">
        <ColorPickerPanel
          palette={HIGHLIGHT_COLORS}
          value={currentColor}
          onChange={handleCommit}
          onPreview={handlePreview}
        />
      </PopoverContent>
    </Popover>
  );
}

export default HighlightButton;
