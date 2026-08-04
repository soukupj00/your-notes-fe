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

/**
 * Wraps the upstream `FontSize` extension (from `@tiptap/extension-text-style`, name
 * `fontSize`, backs `setFontSize` / `unsetFontSize` on the `textStyle` mark) with a
 * Pattern A `button` that returns the {@link FontSizeButton} dropdown. `TextStyle` must
 * also be registered for the font-size attribute to exist.
 */
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
