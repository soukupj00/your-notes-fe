import {
  BoldIcon,
  FlipHorizontalIcon,
  ItalicIcon,
  RemoveFormattingIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import type React from 'react';
import Toolbar from '@/components/editor/menus/ToolbarSection.tsx';
import type { FormatAction, ToolbarSectionProps } from '@/types.ts';

type TextStyleAction = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'clearFormatting';

interface TextStyle extends FormatAction {
  value: TextStyleAction;
}

const formatActions: TextStyle[] = [
  {
    value: 'bold',
    label: 'Bold',
    icon: <BoldIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
    canExecute: (editor) => editor.can().chain().focus().toggleBold().run(),
    shortcuts: ['mod', 'B'],
  },
  {
    value: 'italic',
    label: 'Italic',
    icon: <ItalicIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
    canExecute: (editor) => editor.can().chain().focus().toggleItalic().run(),
    shortcuts: ['mod', 'I'],
  },
  {
    value: 'underline',
    label: 'Underline',
    icon: <UnderlineIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
    canExecute: (editor) => editor.can().chain().focus().toggleUnderline().run(),
    shortcuts: ['mod', 'U'],
  },
  {
    value: 'strikethrough',
    label: 'Strikethrough',
    icon: <StrikethroughIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
    canExecute: (editor) => editor.can().chain().focus().toggleStrike().run(),
    shortcuts: ['mod', 'shift', 'S'],
  },
  {
    value: 'clearFormatting',
    label: 'Clear Formatting',
    icon: <RemoveFormattingIcon className="size-5" />,
    action: (editor) => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    isActive: () => false,
    canExecute: (editor) => editor.can().chain().focus().clearNodes().unsetAllMarks().run(),
    shortcuts: ['mod', '\\'],
  },
];

export const FormatSection: React.FC<ToolbarSectionProps> = ({
  editor,
  activeActions = formatActions.map((action) => action.value),
  mainActionCount = 5,
  size,
  variant,
}) => {
  return (
    <Toolbar
      editor={editor}
      actions={formatActions}
      activeActions={activeActions}
      mainActionCount={mainActionCount}
      dropdownIcon={<FlipHorizontalIcon className="size-5" />}
      dropdownTooltip="More formatting options"
      dropdownClassName="w-8"
      size={size}
      variant={variant}
    />
  );
};

export default FormatSection;
