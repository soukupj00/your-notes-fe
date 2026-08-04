import type { Editor } from '@tiptap/core';

export interface LinkPromptCoordinator {
  /** True when a mounted `LinkButton` took the request and opened its popover. */
  requestOpen(): boolean;
  registerButton(open: () => void): () => void;
}

/**
 * Bridges the `Mod+K` shortcut to the `LinkButton` that owns the URL popover.
 *
 * Unlike the audio coordinator this one is **not** pending-then-fire: a link
 * request that nobody takes must not sit around waiting for a toolbar to
 * remount, it must fall back immediately. `requestOpen` reports whether it
 * landed, so the extension can prompt instead - which is the case whenever
 * `format` is collapsed and the button is only rendered inside a closed menu.
 * A shortcut that silently does nothing is worse than an ugly prompt.
 */
export function createLinkPromptCoordinator(): LinkPromptCoordinator {
  let current: (() => void) | null = null;

  return {
    requestOpen() {
      if (!current) return false;
      current();
      return true;
    },

    registerButton(open) {
      current = open;
      return () => {
        if (current === open) current = null;
      };
    },
  };
}

/**
 * Apply a link from a typed URL. The collapsed-cursor branch inserts the URL as
 * its own link text, because `setLink` on an empty selection marks nothing and
 * would look like the command failed.
 */
export function applyLink(editor: Editor, url: string): void {
  const href = url.trim();
  if (!href) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  if (editor.state.selection.empty) {
    editor.chain().focus().insertContent(href).run();
    const to = editor.state.selection.from;
    editor
      .chain()
      .setTextSelection({ from: to - href.length, to })
      .setLink({ href })
      .focus()
      .run();
    return;
  }
  editor.chain().focus().setLink({ href }).run();
}
