import {
  type BackgroundColorOptions,
  BackgroundColor as TiptapBackgroundColor,
} from '@tiptap/extension-text-style';
import type { ComponentProps } from 'react';
import type { ButtonContext } from '../button-types';
import { HighlightButton } from './HighlightButton';

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
        componentProps: { editor, tooltip: t('editor.highlight.tooltip') },
      }),
    } as unknown as HighlightExtensionOptions;
  },
});
