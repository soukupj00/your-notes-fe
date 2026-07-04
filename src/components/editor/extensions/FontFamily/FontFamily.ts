import {
  type FontFamilyOptions,
  FontFamily as TiptapFontFamily,
} from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import type { ButtonContext } from '../button-types';
import { FontFamilyButton } from './FontFamilyButton';

interface FontFamilyButtonView {
  component: typeof FontFamilyButton;
  componentProps: ComponentProps<typeof FontFamilyButton>;
  hideOnMobile?: boolean;
}

export interface FontFamilyExtensionOptions extends FontFamilyOptions {
  button: (context: ButtonContext) => FontFamilyButtonView;
}

/**
 * Wraps the upstream `FontFamily` extension (from `@tiptap/extension-text-style`, name
 * `fontFamily`, backs `setFontFamily` / `unsetFontFamily` on the `textStyle` mark) with a
 * Pattern A `button` that returns the {@link FontFamilyButton} dropdown. `TextStyle` must
 * also be registered for the font-family attribute to exist.
 */
export const FontFamily = TiptapFontFamily.extend<FontFamilyExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: FontFamilyButton,
        componentProps: { editor, tooltip: t('editor.fontFamily.tooltip') },
        // Mobile-first: hidden below `sm` to keep the mobile toolbar lean (Balanced preset).
        hideOnMobile: true,
      }),
    } as unknown as FontFamilyExtensionOptions;
  },
});
