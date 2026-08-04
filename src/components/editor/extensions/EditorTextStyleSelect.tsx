import type { Editor } from '@tiptap/react';
import { CaseSensitive, type LucideIcon, Type } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TFunction } from './button-types';

export type EditorTextStyleVariant = 'fontFamily' | 'fontSize';

interface EditorTextStyleSelectProps {
  editor: Editor;
  tooltip?: string;
  t: TFunction;
  variant: EditorTextStyleVariant;
}

/** Radix Select.Item forbids an empty-string value. */
const DEFAULT_VALUE = '__default__';

interface StyleOption {
  value: string;
  /** i18n key for the full name, shown in the open menu. */
  labelKey: string;
  /**
   * What the closed trigger shows. It has to be short enough for a toolbar and
   * distinct enough to read at a glance - "Default" on both selects told the
   * user nothing about which control they were looking at, and on a phone,
   * where the tooltip never appears, it was the only thing they had.
   */
  short: string;
}

const OPTIONS: Record<EditorTextStyleVariant, StyleOption[]> = {
  fontFamily: [
    { value: DEFAULT_VALUE, labelKey: 'editor.fontFamily.options.default', short: 'Aa' },
    {
      value: 'ui-sans-serif, system-ui, sans-serif',
      labelKey: 'editor.fontFamily.options.sans',
      short: 'Sans',
    },
    {
      value: 'ui-serif, Georgia, serif',
      labelKey: 'editor.fontFamily.options.serif',
      short: 'Serif',
    },
    {
      value: 'ui-monospace, SFMono-Regular, monospace',
      labelKey: 'editor.fontFamily.options.mono',
      short: 'Mono',
    },
  ],
  fontSize: [
    { value: DEFAULT_VALUE, labelKey: 'editor.fontSize.options.default', short: 'Auto' },
    ...['12px', '14px', '16px', '18px', '24px', '32px'].map((size) => ({
      value: size,
      labelKey: '',
      short: size.replace('px', ''),
    })),
  ],
};

const ICONS: Record<EditorTextStyleVariant, LucideIcon> = {
  fontFamily: Type,
  fontSize: CaseSensitive,
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

/**
 * A menu row previews what it does: a family renders in its own face, a size at
 * its own size. Scanning the list is then reading the answer rather than
 * decoding a name.
 */
function previewStyle(
  variant: EditorTextStyleVariant,
  option: StyleOption
): React.CSSProperties | undefined {
  if (option.value === DEFAULT_VALUE) return undefined;
  return variant === 'fontFamily'
    ? { fontFamily: option.value }
    : { fontSize: option.value, lineHeight: 1.2 };
}

/** Shared toolbar select for the font-related attributes on the textStyle mark. */
export function EditorTextStyleSelect({ editor, tooltip, t, variant }: EditorTextStyleSelectProps) {
  const currentValue: string = editor.getAttributes('textStyle')[variant] || '';
  const options = OPTIONS[variant];
  const Icon = ICONS[variant];
  const current = options.find((option) => option.value === (currentValue || DEFAULT_VALUE));

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
            {/* The icon, not the tooltip, is what says which select this is.
                A tooltip cannot: there is no hover on a touch screen. */}
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <SelectValue>{current?.short ?? currentValue}</SelectValue>
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
          <SelectItem key={option.value} value={option.value} style={previewStyle(variant, option)}>
            {option.labelKey ? t(option.labelKey) : option.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
