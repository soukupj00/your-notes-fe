import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { exitSuggestion, type SuggestionOptions } from '@tiptap/suggestion';
import type { AttachmentDeps } from '../attachments/deps';
import type { TFunction } from '../button-types';
import { SlashMenuList, type SlashMenuListHandle } from './SlashMenuList';
import { filterSlashItems, type SlashItem } from './slashItems';

/** Everything the toolbar offers, reachable without leaving the text: on mobile the toolbar
 *  competes with the virtual keyboard. `startOfLine` keeps it from firing on a URL path or a
 *  date typed mid-sentence. */
export function createSlashMenu(getDeps: () => AttachmentDeps, t: TFunction) {
  return Extension.create({
    name: 'slashMenu',

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          allowSpaces: false,
          items: ({ query }) => filterSlashItems(query, t),
          command: ({ editor, range, props }) => {
            (props as SlashItem).run({ editor, range, deps: getDeps(), t });
          },
          render: createRenderer(t),
        } as SuggestionOptions<SlashItem>),
      ];
    },
  });
}

/** Mounted in the Note's dialog, the only subtree a Radix modal leaves open to the pointer and
 *  to scrolling, and shown in the top layer so the dialog's overflow does not clip it.
 *  Without the Popover API the rows still work, clipped: CLAUDE.md, "Browser support". */
function createRenderer(t: TFunction): SuggestionOptions<SlashItem>['render'] {
  return () => {
    let component: ReactRenderer<SlashMenuListHandle> | null = null;
    let container: HTMLElement | null = null;
    let closeOnEscape: ((event: KeyboardEvent) => void) | null = null;
    let caretRect: (() => DOMRect | null) | null | undefined = null;
    let stopPlacing: (() => void) | null = null;

    const place = () => {
      const rect = caretRect?.();
      if (!rect || !container) return;
      void computePosition(
        {
          getBoundingClientRect: () => rect,
          contextElement: document.body,
        },
        container,
        {
          strategy: 'fixed',
          placement: 'bottom-start',
          middleware: [offset(6), flip(), shift({ padding: 8 })],
        }
      ).then(({ x, y }) => {
        if (!container) return;
        Object.assign(container.style, { left: `${x}px`, top: `${y}px` });
      });
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashMenuList, {
          props: { items: props.items, command: props.command, t },
          editor: props.editor,
        });
        container = document.createElement('div');
        container.popover = 'manual';
        // The classes undo the browser's popover box (centred, bordered, padded, opaque).
        container.className =
          'fixed inset-auto z-50 m-0 overflow-visible border-0 bg-transparent p-0';
        container.appendChild(component.element);
        const dialog = props.editor.view.dom.closest('[role="dialog"]');
        (dialog ?? document.body).appendChild(container);
        container.showPopover?.();
        caretRect = props.clientRect;
        // Placed again whenever its size changes, as the rows render after this runs and a
        // query changes their count, and whenever the Note scrolls, to stay on the caret.
        stopPlacing = autoUpdate(props.editor.view.dom, container, place);

        // The note dialog closes on Escape in the document's capture phase, before the editor
        // sees the key, so the menu takes it earlier still, on window.
        const { view } = props.editor;
        closeOnEscape = (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          exitSuggestion(view);
        };
        window.addEventListener('keydown', closeOnEscape, { capture: true });
      },

      onUpdate: (props) => {
        component?.updateProps({ items: props.items, command: props.command, t });
        caretRect = props.clientRect;
      },

      onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,

      onExit: () => {
        if (closeOnEscape) window.removeEventListener('keydown', closeOnEscape, { capture: true });
        closeOnEscape = null;
        stopPlacing?.();
        stopPlacing = null;
        container?.remove();
        component?.destroy();
        container = null;
        component = null;
      },
    };
  };
}
