import { type ColorOptions, Color as TiptapColor } from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorColorPickerButton } from '../EditorColorPickerButton';

export interface ColorExtensionOptions extends ColorOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorColorPickerButton>;
}

/** `TextStyle` must also be registered, or the color attribute does not exist. */
export const Color = TiptapColor.extend<ColorExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorColorPickerButton> => ({
        component: EditorColorPickerButton,
        componentProps: { editor, tooltip: t('editor.textColor.tooltip'), variant: 'text' },
      }),
    } as unknown as ColorExtensionOptions;
  },
});
