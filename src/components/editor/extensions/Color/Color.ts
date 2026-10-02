import { type ColorOptions, Color as TiptapColor } from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import type { ButtonContext } from '../button-types';
import { TextColorButton } from './TextColorButton';

interface ColorButtonView {
  component: typeof TextColorButton;
  componentProps: ComponentProps<typeof TextColorButton>;
}

export interface ColorExtensionOptions extends ColorOptions {
  button: (context: ButtonContext) => ColorButtonView;
}

/** `TextStyle` must also be registered, or the color attribute does not exist. */
export const Color = TiptapColor.extend<ColorExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: TextColorButton,
        componentProps: { editor, tooltip: t('editor.textColor.tooltip') },
      }),
    } as unknown as ColorExtensionOptions;
  },
});
