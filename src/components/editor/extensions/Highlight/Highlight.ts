import {
  type BackgroundColorOptions,
  BackgroundColor as TiptapBackgroundColor,
} from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import { HIGHLIGHT_COLORS } from '@/components/color-picker/palettes.ts';
import type { ButtonContext } from '../button-types';
import { HighlightButton } from './HighlightButton';

/** What `Mod+Shift+H` applies: the common case, the picker covers the rest. */
const SHORTCUT_COLOR =
  HIGHLIGHT_COLORS.colors.find((color) => color.label === 'Yellow')?.cssValue ?? '#fef08a';

interface HighlightButtonView {
  component: typeof HighlightButton;
  componentProps: ComponentProps<typeof HighlightButton>;
}

export interface HighlightExtensionOptions extends BackgroundColorOptions {
  button: (context: ButtonContext) => HighlightButtonView;
}

/** `TextStyle` must also be registered, or the backgroundColor attribute does not exist. */
export const Highlight = TiptapBackgroundColor.extend<HighlightExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: HighlightButton,
        componentProps: {
          editor,
          tooltip: t('editor.highlight.tooltip'),
          shortcutKeys: ['Mod', 'Shift', 'H'],
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
