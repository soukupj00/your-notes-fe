import type { Editor } from '@tiptap/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type EditorTextStyleVariant = 'fontFamily' | 'fontSize';

interface EditorTextStyleSelectProps {
  editor: Editor;
  tooltip?: string;
  variant: EditorTextStyleVariant;
}

/** Radix Select.Item forbids an empty-string value. */
const DEFAULT_VALUE = '__default__';

const OPTIONS: Record<EditorTextStyleVariant, { value: string; label: string }[]> = {
  fontFamily: [
    { value: DEFAULT_VALUE, label: 'Default' },
    { value: 'ui-sans-serif, system-ui, sans-serif', label: 'Sans-serif' },
    { value: 'ui-serif, Georgia, serif', label: 'Serif' },
    { value: 'ui-monospace, SFMono-Regular, monospace', label: 'Monospace' },
  ],
  fontSize: [
    { value: DEFAULT_VALUE, label: 'Default' },
    { value: '12px', label: '12px' },
    { value: '14px', label: '14px' },
    { value: '16px', label: '16px' },
    { value: '18px', label: '18px' },
    { value: '24px', label: '24px' },
    { value: '32px', label: '32px' },
  ],
};

function updateTextStyle(editor: Editor, variant: EditorTextStyleVariant, value: string): void {
  const isDefault = value === DEFAULT_VALUE;
  const chain = editor.chain().focus();

  if (variant === 'fontFamily') {
    if (isDefault) chain.unsetFontFamily().run();
    else chain.setFontFamily(value).run();
    return;
  }

  if (isDefault) chain.unsetFontSize().run();
  else chain.setFontSize(value).run();
}

/** Shared toolbar select for the font-related attributes on the textStyle mark. */
export function EditorTextStyleSelect({ editor, tooltip, variant }: EditorTextStyleSelectProps) {
  const currentValue: string = editor.getAttributes('textStyle')[variant] || '';
  const options = OPTIONS[variant];

  return (
    <Select
      value={currentValue || DEFAULT_VALUE}
      onValueChange={(value) => updateTextStyle(editor, variant, value)}
    >
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
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={
              variant === 'fontFamily' && option.value !== DEFAULT_VALUE
                ? { fontFamily: option.value }
                : undefined
            }
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
