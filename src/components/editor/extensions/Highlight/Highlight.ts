import {
  type BackgroundColorOptions,
  BackgroundColor as TiptapBackgroundColor,
} from '@tiptap/extension-text-style';
import { HIGHLIGHT_COLORS } from '@/components/color-picker/palettes.ts';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorColorPickerButton } from '../EditorColorPickerButton';

/** What `Mod+Shift+H` applies: the common case, the picker covers the rest. */
const SHORTCUT_COLOR =
  HIGHLIGHT_COLORS.colors.find((color) => color.label === 'Yellow')?.cssValue ?? '#fef08a';

export interface HighlightExtensionOptions extends BackgroundColorOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorColorPickerButton>;
}

/** `TextStyle` must also be registered, or the backgroundColor attribute does not exist. */
export const Highlight = TiptapBackgroundColor.extend<HighlightExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorColorPickerButton> => ({
        component: EditorColorPickerButton,
        componentProps: {
          editor,
          tooltip: t('editor.highlight.tooltip'),
          shortcutKeys: ['Mod', 'Shift', 'H'],
          variant: 'highlight',
        },
      }),
    } as unknown as HighlightExtensionOptions;
  },

  // Toggles rather than opening the picker: a popover cannot open from a shortcut while its
  // button sits in a collapsed family.
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () =>
        this.editor.getAttributes('textStyle').backgroundColor
          ? this.editor.chain().focus().unsetBackgroundColor().run()
          : this.editor.chain().focus().setBackgroundColor(SHORTCUT_COLOR).run(),
    };
  },
});
