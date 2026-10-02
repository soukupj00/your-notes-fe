import type { Editor } from '@tiptap/core';

export interface LinkPromptCoordinator {
  /** True when a mounted `LinkButton` took the request and opened its popover. */
  requestOpen(): boolean;
  registerButton(open: () => void): () => void;
}

/** Unlike the audio coordinator, not pending-then-fire: an untaken request falls back to a
 *  prompt at once (no button is mounted while `format` is collapsed), because a shortcut
 *  that silently does nothing is worse than an ugly prompt. */
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

/** With a collapsed cursor the URL becomes its own link text, because `setLink` on an empty
 *  selection marks nothing and looks like a failure. */
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
