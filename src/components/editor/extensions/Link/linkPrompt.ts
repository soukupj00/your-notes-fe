import type { Editor } from '@tiptap/core';
import type { TFunction } from '../button-types';
import { askText } from '../TextPrompt/textPrompt';

export interface LinkPromptCoordinator {
  /** True when a `LinkButton` on screen took the request and opened its popover. */
  requestOpen(): boolean;
  /** `open` returns false when its trigger is off screen: the bubble menu keeps its button
   *  mounted while hidden, and a popover anchored to nothing opens in the page corner. */
  registerButton(open: () => boolean): () => void;
}

/** Unlike the audio coordinator, not pending-then-fire: an untaken request falls back to the
 *  text prompt at once (no button is mounted while its family is collapsed), because a
 *  shortcut that silently does nothing is worse than a dialog in place of a popover. */
export function createLinkPromptCoordinator(): LinkPromptCoordinator {
  const buttons = new Set<() => boolean>();

  return {
    requestOpen() {
      for (const open of buttons) if (open()) return true;
      return false;
    },

    registerButton(open) {
      buttons.add(open);
      return () => {
        buttons.delete(open);
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

/** The link shortcut: the mounted button's popover, else the text prompt. `t` is called now,
 *  not at build time, so the label follows the current language. */
export async function openLinkPrompt(editor: Editor, t: TFunction): Promise<void> {
  if (editor.storage.link.prompt.requestOpen()) return;
  const url = await askText(editor, {
    kind: 'url',
    title: t('editor.link.url'),
    confirmLabel: t('editor.link.apply'),
    initial: (editor.getAttributes('link').href as string | undefined) ?? '',
  });
  if (url !== null) applyLink(editor, url);
}
