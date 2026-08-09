import {
  type BackgroundColorOptions,
  BackgroundColor as TiptapBackgroundColor,
} from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import { HIGHLIGHT_COLORS } from '@/components/color-picker/palettes.ts';
import type { ButtonContext } from '../button-types';
import { HighlightButton } from './HighlightButton';

/**
 * What `Mod+Shift+H` applies. Yellow, because a highlighter is yellow - the
 * shortcut is for the common case, and the picker is still there for the rest.
 */
const SHORTCUT_COLOR =
  HIGHLIGHT_COLORS.colors.find((color) => color.label === 'Yellow')?.cssValue ?? '#fef08a';

interface HighlightButtonView {
  component: typeof HighlightButton;
  componentProps: ComponentProps<typeof HighlightButton>;
}

export interface HighlightExtensionOptions extends BackgroundColorOptions {
  button: (context: ButtonContext) => HighlightButtonView;
}

/**
 * Wraps the upstream `BackgroundColor` extension (from `@tiptap/extension-text-style`, name
 * `backgroundColor`, backs `setBackgroundColor` / `unsetBackgroundColor` on the `textStyle`
 * mark) with a Pattern A `button` that returns the {@link HighlightButton} popover trigger.
 * `TextStyle` must also be registered for the backgroundColor attribute to exist.
 */
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

  // The shortcut toggles rather than opening the picker: a popover cannot be
  // opened from a keyboard shortcut when its button is inside a collapsed
  // family, and "highlight this" is what the key is reached for anyway.
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () =>
        this.editor.getAttributes('textStyle').backgroundColor
          ? this.editor.chain().focus().unsetBackgroundColor().run()
          : this.editor.chain().focus().setBackgroundColor(SHORTCUT_COLOR).run(),
    };
  },
});
