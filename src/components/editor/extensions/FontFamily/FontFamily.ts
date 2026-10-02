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
}

export interface FontFamilyExtensionOptions extends FontFamilyOptions {
  button: (context: ButtonContext) => FontFamilyButtonView;
}

/** `TextStyle` must also be registered, or the fontFamily attribute does not exist. */
export const FontFamily = TiptapFontFamily.extend<FontFamilyExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: FontFamilyButton,
        componentProps: { editor, t, tooltip: t('editor.fontFamily.tooltip') },
      }),
    } as unknown as FontFamilyExtensionOptions;
  },
});
