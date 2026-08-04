import { type LinkOptions, Link as TiptapLink } from '@tiptap/extension-link';
import type { ComponentProps } from 'react';
import type { ButtonContext } from '../button-types';
import { LinkButton } from './LinkButton';

interface LinkButtonView {
  component: typeof LinkButton;
  componentProps: ComponentProps<typeof LinkButton>;
}

export interface LinkExtensionOptions extends LinkOptions {
  button: (context: ButtonContext) => LinkButtonView;
}

/**
 * Links, with a custom-component button (the URL popover) rather than an
 * `ActionButton`, since applying a link needs a value, not a toggle.
 *
 * `openOnClick: false` because the editor is an editing surface: clicking a
 * link there should place the cursor, not navigate away from an unsaved note.
 * Autolink and link-on-paste stay on - pasting a URL onto selected text is the
 * single most common way a link gets made.
 */
export const Link = TiptapLink.extend<LinkExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      button: ({ editor, t }: ButtonContext) => ({
        component: LinkButton,
        componentProps: { editor, t, tooltip: t('editor.link.tooltip') },
      }),
    } as unknown as LinkExtensionOptions;
  },
});
