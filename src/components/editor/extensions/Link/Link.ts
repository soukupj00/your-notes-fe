import { type LinkOptions, Link as TiptapLink } from '@tiptap/extension-link';
import type { ButtonContext, ButtonView } from '../button-types';
import { LinkButton } from './LinkButton';
import { createLinkPromptCoordinator, type LinkPromptCoordinator } from './linkPrompt';

export interface LinkExtensionOptions extends LinkOptions {
  button: (context: ButtonContext) => ButtonView<typeof LinkButton>;
}

declare module '@tiptap/core' {
  interface Storage {
    link: { prompt: LinkPromptCoordinator };
  }
}

/** `openOnClick: false`: a click in the editor places the cursor rather than leaving an
 *  unsaved note. */
export const Link = TiptapLink.extend<LinkExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      button: ({ editor, t: translate }: ButtonContext): ButtonView<typeof LinkButton> => ({
        component: LinkButton,
        componentProps: {
          editor,
          t: translate,
          tooltip: translate('editor.link.tooltip'),
        },
      }),
    } as unknown as LinkExtensionOptions;
  },

  addStorage() {
    return { prompt: createLinkPromptCoordinator() };
  },
});
