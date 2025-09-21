import type { toggleVariants } from '@/components/ui/toggle.tsx';
import type { Editor } from '@tiptap/react';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';

/**
 * Represents the props for the ButtonView component.
 */
export interface ButtonViewReturnComponentProps {
  /** Method triggered when action is performed */
  action?: (value?: any) => void;
  /** Whether it is in the active state */
  isActive?: () => boolean;
  /** Button icon */
  icon?: any;
  /** Text displayed on hover */
  tooltip?: string;
  [x: string]: any;
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
