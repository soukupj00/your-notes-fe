import { type FontSizeOptions, FontSize as TiptapFontSize } from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorTextStyleSelect } from '../EditorTextStyleSelect';

export interface FontSizeExtensionOptions extends FontSizeOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorTextStyleSelect>;
}

/** `TextStyle` must also be registered, or the fontSize attribute does not exist. */
export const FontSize = TiptapFontSize.extend<FontSizeExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorTextStyleSelect> => ({
        component: EditorTextStyleSelect,
        componentProps: { editor, t, tooltip: t('editor.fontSize.tooltip'), variant: 'fontSize' },
      }),
    } as unknown as FontSizeExtensionOptions;
  },
});
