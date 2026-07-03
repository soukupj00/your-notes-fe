import type { Editor } from '@tiptap/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FontSizeButtonProps {
  editor: Editor;
  tooltip?: string;
}

/** Sentinel value for the "Default" item — Radix `Select.Item` forbids an empty-string value. */
const DEFAULT = '__default__';

const FONT_SIZES = [
  { value: DEFAULT, label: 'Default' },
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '24px', label: '24px' },
  { value: '32px', label: '32px' },
];

/**
 * Toolbar dropdown for the editor font size (Pattern A custom component, like
 * `TextColorButton`). A compact shadcn `Select` reads/writes the `textStyle` mark's
 * `fontSize` attribute; the "Default" item unsets it via the sentinel `DEFAULT` value.
 */
export function FontSizeButton({ editor, tooltip }: FontSizeButtonProps) {
  const currentFontSize: string = editor.getAttributes('textStyle').fontSize || '';
  const value = currentFontSize || DEFAULT;

  const handleValueChange = (next: string) => {
    if (next === DEFAULT) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(next).run();
    }
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SelectTrigger
            aria-label={tooltip}
            size="sm"
            className="h-8 w-auto min-w-0 gap-1 px-2 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="top" align="center">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
      <SelectContent>
        {FONT_SIZES.map((size) => (
          <SelectItem key={size.value} value={size.value}>
            {size.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FontSizeButton;
