import { type LinkOptions, Link as TiptapLink } from '@tiptap/extension-link';
import type { ComponentProps } from 'react';
import type { ButtonContext, TFunction } from '../button-types';
import { LinkButton } from './LinkButton';
import { applyLink, createLinkPromptCoordinator, type LinkPromptCoordinator } from './linkPrompt';

interface LinkButtonView {
  component: typeof LinkButton;
  componentProps: ComponentProps<typeof LinkButton>;
}

export interface LinkExtensionOptions extends LinkOptions {
  button: (context: ButtonContext) => LinkButtonView;
}

declare module '@tiptap/core' {
  interface Storage {
    link: { prompt: LinkPromptCoordinator };
  }
}

/** `openOnClick: false`: a click in the editor places the cursor rather than leaving an
 *  unsaved note. A factory (the `createMathematics` shape) because the `Mod+K` fallback
 *  prompt needs `t`, and the extension is built once, outside React. */
export function createLink(t: TFunction) {
  return TiptapLink.extend<LinkExtensionOptions>({
    addOptions() {
      return {
        ...this.parent?.(),
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        button: ({ editor, t: translate }: ButtonContext) => ({
          component: LinkButton,
          componentProps: {
            editor,
            t: translate,
            tooltip: translate('editor.link.tooltip'),
            shortcutKeys: ['Mod', 'K'],
          },
        }),
      } as unknown as LinkExtensionOptions;
    },

    addStorage() {
      return { prompt: createLinkPromptCoordinator() };
    },

    addKeyboardShortcuts() {
      return {
        // Returning true keeps the browser's own Ctrl+K out of the editor.
        'Mod-k': () => {
          if (this.storage.prompt.requestOpen()) return true;
          // No button is mounted (its family is collapsed), so prompt directly. `t` is
          // called here, not at build time, so the label follows the current language.
          const url = window.prompt(t('editor.link.url'), '');
          if (url !== null) applyLink(this.editor, url);
          return true;
        },
      };
    },
  });
}
