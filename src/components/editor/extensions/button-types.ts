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
  /**
   * When true, the button is hidden below the `sm` breakpoint (640px) and only
   * shown on larger screens. Mobile-first: use it to keep the mobile toolbar lean
   * (e.g. Heading H2/H3). Applied generically by `ExtensionButtonBar`, so it works
   * for any extension's buttons, including custom-component ones.
   */
  hideOnMobile?: boolean;
}
