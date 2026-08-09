import type { Editor } from '@tiptap/core';
import type { ActionButton, ActionButtonProps } from '@/components/ui/ActionButton.tsx';

/** Subset of i18next's TFunction covering how button factories use it */
export type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/** Arguments passed into every extension's button factory */
export interface ButtonContext {
  editor: Editor;
  t: TFunction;
}

/** A single toolbar button descriptor returned by an extension's button factory */
export interface ButtonView {
  component: typeof ActionButton;
  componentProps: ActionButtonProps;
}
