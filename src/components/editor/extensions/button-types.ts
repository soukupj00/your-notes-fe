import type { Editor } from '@tiptap/core';
import type { ComponentProps, ElementType } from 'react';
import type { ActionButton } from '@/components/ui/ActionButton.tsx';

/** Subset of i18next's TFunction covering how button factories use it */
export type TFunction = (key: string, opts?: Record<string, unknown>) => string;

export interface ButtonContext {
  editor: Editor;
  t: TFunction;
}

/**
 * What an extension's `button` option yields: a component and the props to render it with.
 * Most leaves are `ActionButton`; a picker or a select names its own component.
 */
export interface ButtonView<C extends ElementType = typeof ActionButton> {
  component: C;
  componentProps: ComponentProps<C>;
}

/** A view of any component, for the places that render whatever an extension yields. */
export type AnyButtonView = ButtonView<ElementType>;

/** The option every Pattern A extension adds (ADR 0004): one view, or several (Heading yields three). */
export type ButtonOption<V = ButtonView | ButtonView[]> = {
  button: (context: ButtonContext) => V;
};
