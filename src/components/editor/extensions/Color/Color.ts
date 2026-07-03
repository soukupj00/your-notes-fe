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

/**
 * Wraps the upstream `Color` extension (from `@tiptap/extension-text-style`, name `color`,
 * backs `setColor` / `unsetColor` on the `textStyle` mark) with a Pattern A `button` that
 * returns the {@link TextColorButton} popover trigger. `TextStyle` must also be registered
 * for the color attribute to exist.
 */
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
