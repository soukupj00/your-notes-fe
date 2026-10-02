import { type FontSizeOptions, FontSize as TiptapFontSize } from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import type { ButtonContext } from '../button-types';
import { FontSizeButton } from './FontSizeButton';

interface FontSizeButtonView {
  component: typeof FontSizeButton;
  componentProps: ComponentProps<typeof FontSizeButton>;
}

export interface FontSizeExtensionOptions extends FontSizeOptions {
  button: (context: ButtonContext) => FontSizeButtonView;
}

/** `TextStyle` must also be registered, or the fontSize attribute does not exist. */
export const FontSize = TiptapFontSize.extend<FontSizeExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: FontSizeButton,
        componentProps: { editor, t, tooltip: t('editor.fontSize.tooltip') },
      }),
    } as unknown as FontSizeExtensionOptions;
  },
});
