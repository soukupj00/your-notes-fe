import type { Editor } from '@tiptap/react';
import type { VariantProps } from 'class-variance-authority';
import type React from 'react';
import type { toggleVariants } from '@/components/ui/toggle.tsx';

export interface ButtonViewReturnComponentProps {
  action?: () => void;
  isActive?: () => boolean;
  icon?: string;
  tooltip?: string;
}

export interface FormatAction {
  label: string;
  icon?: React.ReactNode;
  action: (editor: Editor) => void;
  isActive: (editor: Editor) => boolean;
  canExecute: (editor: Editor) => boolean;
  shortcuts: string[];
  value: string;
}

export interface ToolbarSectionProps extends VariantProps<typeof toggleVariants> {
  editor: Editor;
  activeActions?: string[];
  mainActionCount?: number;
}
