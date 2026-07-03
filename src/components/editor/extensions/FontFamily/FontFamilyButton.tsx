import type { Editor } from '@tiptap/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FontFamilyButtonProps {
  editor: Editor;
  tooltip?: string;
}

/** Sentinel value for the "Default" item — Radix `Select.Item` forbids an empty-string value. */
const DEFAULT = '__default__';

const FONT_FAMILIES = [
  { value: DEFAULT, label: 'Default' },
  { value: 'ui-sans-serif, system-ui, sans-serif', label: 'Sans-serif' },
  { value: 'ui-serif, Georgia, serif', label: 'Serif' },
  { value: 'ui-monospace, SFMono-Regular, monospace', label: 'Monospace' },
];

/**
 * Toolbar dropdown for the editor font family (Pattern A custom component, like
 * `TextColorButton`). A compact shadcn `Select` reads/writes the `textStyle` mark's
 * `fontFamily` attribute; the "Default" item unsets it via the sentinel `DEFAULT` value.
 */
export function FontFamilyButton({ editor, tooltip }: FontFamilyButtonProps) {
  const currentFontFamily: string = editor.getAttributes('textStyle').fontFamily || '';
  const value = currentFontFamily || DEFAULT;

  const handleValueChange = (next: string) => {
    if (next === DEFAULT) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(next).run();
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
        {FONT_FAMILIES.map((font) => (
          <SelectItem
            key={font.value}
            value={font.value}
            style={font.value === DEFAULT ? undefined : { fontFamily: font.value }}
          >
            {font.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FontFamilyButton;
