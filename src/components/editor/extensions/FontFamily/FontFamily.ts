import {
  type FontFamilyOptions,
  FontFamily as TiptapFontFamily,
} from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorTextStyleSelect } from '../EditorTextStyleSelect';

export interface FontFamilyExtensionOptions extends FontFamilyOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorTextStyleSelect>;
}

/** `TextStyle` must also be registered, or the fontFamily attribute does not exist. */
export const FontFamily = TiptapFontFamily.extend<FontFamilyExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorTextStyleSelect> => ({
        component: EditorTextStyleSelect,
        componentProps: {
          editor,
          t,
          tooltip: t('editor.fontFamily.tooltip'),
          variant: 'fontFamily',
        },
      }),
    } as unknown as FontFamilyExtensionOptions;
  },
});
