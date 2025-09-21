import ToolbarButton from '@/components/editor/menus/ToolbarButton.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import type { toggleVariants } from '@/components/ui/toggle.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { useTheme } from '@/context/themeProvider.tsx';
import { cn } from '@/lib/utils.ts';
import { Editor } from '@tiptap/react';
import type { VariantProps } from 'class-variance-authority';
import { Baseline, CheckIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type ColorItem = {
  lightLabel: string;
  darkLabel?: string;
  cssValue: string;
};

type ColorPalette = {
  label: string;
  inverse: string;
  colors: ColorItem[];
};

const TEXT_COLORS: ColorPalette = {
  label: 'Text Colors',
  inverse: 'hsl(var(--background))',
  colors: [
    { lightLabel: 'Red', cssValue: '#ef4444' }, // red-500
    { lightLabel: 'Orange', cssValue: '#f97316' }, // orange-500
    { lightLabel: 'Yellow', cssValue: '#eab308' }, // yellow-500
    { lightLabel: 'Green', cssValue: '#22c55e' }, // green-500
    { lightLabel: 'Blue', cssValue: '#3b82f6' }, // blue-500
    { lightLabel: 'Indigo', cssValue: '#6366f1' }, // indigo-500
    { lightLabel: 'Purple', cssValue: '#a855f7' }, // purple-500
    { lightLabel: 'Pink', cssValue: '#ec4899' }, // pink-500
  ],
};

const MemoizedColorToggle = React.memo<{
  color: ColorItem;
  isSelected: boolean;
  inverseColor: string;
  onClick: (color: string) => void;
}>(({ color, isSelected, inverseColor, onClick }) => {
  const { theme } = useTheme();
  const isDark = theme && theme === 'dark';
  const label = isDark ? color.darkLabel : color.lightLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          tabIndex={0}
          className="relative size-5 rounded-md p-0"
          value={color.cssValue}
          aria-label={label}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            onClick(color.cssValue);
          }}
          style={{ backgroundColor: color.cssValue }}
        >
          {isSelected && (
            <CheckIcon className="absolute inset-0 m-auto size-5" style={{ color: inverseColor }} />
          )}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const TextColorPicker = React.memo<{
  palette: ColorPalette;
  selectedColor: string;
  inverseColor: string;
  onColorChange: (color: string) => void;
}>(({ palette, selectedColor, inverseColor, onColorChange }) => (
  <ToggleGroup
    type="single"
    value={selectedColor}
    onValueChange={(value: string) => {
      if (value) {
        onColorChange(value);
      }
    }}
    className="gap-1"
  >
    {palette.colors.map((color: ColorItem, index) => (
      <MemoizedColorToggle
        key={index}
        color={color}
        isSelected={selectedColor === color.cssValue}
        inverseColor={inverseColor}
        onClick={onColorChange}
      />
    ))}
  </ToggleGroup>
));

interface Props extends VariantProps<typeof toggleVariants> {
  editor: Editor;
}

export const TextColorPickerButton: React.FC<Props> = ({ editor, size, variant }) => {
  if (!editor) return null;

  const color = editor.getAttributes('textStyle')?.color || 'hsl(var(--foreground))';
  const [selectedColor, setSelectedColor] = useState<string>(color);

  const handleColorChange = React.useCallback(
    (color: string) => {
      setSelectedColor(color);
      if (editor.state.storedMarks) {
        const textStyleMark = editor.schema.marks.textStyle;
        if (textStyleMark) {
          editor.view.dispatch(editor.state.tr.removeStoredMark(textStyleMark));
        }
      }
      setTimeout(() => {
        editor.chain().focus().setColor(color).run();
      }, 0);
    },
    [editor]
  );

  useEffect(() => {
    setSelectedColor(selectedColor);
  }, [selectedColor]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarButton
          tooltip="Text Color"
          aria-label="Text color"
          className="relative"
          size={size}
          variant={variant}
        >
          <Baseline className={cn('h-5 w-5')} style={{ color: selectedColor ?? 'inherit' }} />
        </ToolbarButton>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-full">
        <div className="mb-2 grid grid-cols-4 gap-2">
          <TextColorPicker
            palette={TEXT_COLORS}
            selectedColor={selectedColor}
            inverseColor={TEXT_COLORS.inverse}
            onColorChange={handleColorChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TextColorPickerButton;
