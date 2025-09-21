import Toolbar from '@/components/editor/menus/ToolbarSection.tsx';
import type { FormatAction, ToolbarSectionProps } from '@/types.ts';
import { FlipHorizontalIcon, ListIcon, ListOrderedIcon } from 'lucide-react';
import React from 'react';

type ListItemAction = 'bulletList' | 'orderedList';

interface ListItem extends FormatAction {
  value: ListItemAction;
}

const formatActions: ListItem[] = [
  {
    value: 'orderedList',
    label: 'Ordered List',
    icon: <ListOrderedIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
    canExecute: (editor) => editor.can().chain().focus().toggleOrderedList().run(),
    shortcuts: ['mod', 'shift', '7'],
  },
  {
    value: 'bulletList',
    label: 'Bullet List',
    icon: <ListIcon className="size-5" />,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
    canExecute: (editor) => editor.can().chain().focus().toggleBulletList().run(),
    shortcuts: ['mod', 'shift', '8'],
  },
];

export const ListSection: React.FC<ToolbarSectionProps> = ({
  editor,
  activeActions = formatActions.map((action) => action.value),
  mainActionCount = 2,
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

export default ListSection;
