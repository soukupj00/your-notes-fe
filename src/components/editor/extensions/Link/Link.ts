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

/**
 * Links, with a custom-component button (the URL popover) rather than an
 * `ActionButton`, since applying a link needs a value, not a toggle.
 *
 * `openOnClick: false` because the editor is an editing surface: clicking a
 * link there should place the cursor, not navigate away from an unsaved note.
 * Autolink and link-on-paste stay on - pasting a URL onto selected text is the
 * single most common way a link gets made.
 *
 * A factory (the `createMathematics` shape) because `Mod+K`'s fallback prompt
 * needs a translated label, and an extension is built once, outside React.
 */
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
        // The universal link shortcut. TipTap binds nothing here, and returning
        // true keeps the browser's own Ctrl+K out of the way inside the editor.
        'Mod-k': () => {
          if (this.storage.prompt.requestOpen()) return true;
          // No button is mounted - the whole `format` family is collapsed, so
          // the popover lives inside a closed menu. Ask directly rather than
          // let the shortcut silently do nothing.
          // Resolved here rather than when the extension is built: the array is
          // built once per editor, so a label read at build time would keep the
          // language the note was opened in.
          const url = window.prompt(t('editor.link.url'), '');
          if (url !== null) applyLink(this.editor, url);
          return true;
        },
      };
    },
  });
}
