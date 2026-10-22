import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { comboFromEvent, typesAltGrCharacter } from '@/lib/key-combo.ts';
import { type ShortcutBindings, shortcutFor } from '@/lib/shortcuts.ts';
import type { TFunction } from '../button-types';
import { EDITOR_ACTIONS } from './actions';

/** The editor's one keymap for the user's Shortcuts, read live so a change applies to an open note. */
export function createShortcuts(getBindings: () => ShortcutBindings, t: TFunction) {
  return Extension.create({
    name: 'shortcuts',
    priority: 1000,
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          props: {
            handleKeyDown: (_view, event) => {
              if (typesAltGrCharacter(event)) return false;
              const combo = comboFromEvent(event);
              const id = combo && shortcutFor(combo, 'editor', getBindings());
              const action = id ? EDITOR_ACTIONS[id] : undefined;
              if (!action) return false;
              action(editor, t);
              return true;
            },
          },
        }),
      ];
    },
  });
}
