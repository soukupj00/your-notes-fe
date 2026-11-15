import { type Editor, Extension } from '@tiptap/core';

export interface TextPromptRequest {
  /** `math` previews the formula as it is typed; `url` asks the keyboard for a web address. */
  kind: 'math' | 'url';
  title: string;
  confirmLabel: string;
  initial?: string;
}

type Answer = (value: string | null) => void;
type Show = (request: TextPromptRequest, answer: Answer) => void;

export interface TextPromptCoordinator {
  /** `null` when the user cancels, and at once when no host is mounted. */
  ask(request: TextPromptRequest): Promise<string | null>;
  registerHost(show: Show): () => void;
}

/** Lets an extension, which is not React, ask the user for one line of text in the app's own
 *  dialog. `TextPromptHost` answers; a newer question cancels the one still open. */
export function createTextPromptCoordinator(): TextPromptCoordinator {
  let show: Show | null = null;
  let open: Answer | null = null;

  return {
    ask(request) {
      open?.(null);
      const host = show;
      if (!host) return Promise.resolve(null);
      return new Promise((resolve) => {
        open = resolve;
        host(request, (value) => {
          if (open === resolve) open = null;
          resolve(value);
        });
      });
    },

    registerHost(next) {
      show = next;
      return () => {
        if (show === next) show = null;
      };
    },
  };
}

declare module '@tiptap/core' {
  interface Storage {
    textPrompt: TextPromptCoordinator;
  }
}

export const TextPrompt = Extension.create({
  name: 'textPrompt',
  addStorage() {
    return createTextPromptCoordinator();
  },
});

/** An editor built without `TextPrompt` (a headless test) answers `null`, like a cancel. */
export function askText(editor: Editor, request: TextPromptRequest): Promise<string | null> {
  return editor.storage.textPrompt?.ask(request) ?? Promise.resolve(null);
}
