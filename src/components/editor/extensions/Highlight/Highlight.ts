import type { Editor } from '@tiptap/core';
import {
  type BackgroundColorOptions,
  BackgroundColor as TiptapBackgroundColor,
} from '@tiptap/extension-text-style';
import { HIGHLIGHT_COLORS } from '@/components/color-picker/palettes.ts';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorColorPickerButton } from '../EditorColorPickerButton';

/** What the shortcut applies: the common case, the picker covers the rest. */
const SHORTCUT_COLOR =
  HIGHLIGHT_COLORS.colors.find((color) => color.label === 'Yellow')?.cssValue ?? '#fef08a';

/** Toggles rather than opening the picker: a popover cannot open from a shortcut while its
 *  button sits in a collapsed family. */
export function toggleDefaultHighlight(editor: Editor) {
  if (editor.getAttributes('textStyle').backgroundColor) {
    editor.chain().focus().unsetBackgroundColor().run();
  } else {
    editor.chain().focus().setBackgroundColor(SHORTCUT_COLOR).run();
  }
}

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
          variant: 'highlight',
        },
      }),
    } as unknown as HighlightExtensionOptions;
  },
});
