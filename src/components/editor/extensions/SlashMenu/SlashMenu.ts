import { computePosition, flip, offset, shift } from '@floating-ui/dom';
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

/** Positioned with floating-ui against the caret, not mounted inline, so it escapes the
 *  editor's overflow and flips above the caret near the bottom of the screen. */
function createRenderer(t: TFunction): SuggestionOptions<SlashItem>['render'] {
  return () => {
    let component: ReactRenderer<SlashMenuListHandle> | null = null;
    let container: HTMLElement | null = null;
    let closeOnEscape: ((event: KeyboardEvent) => void) | null = null;

    const place = (clientRect: (() => DOMRect | null) | null | undefined) => {
      const rect = clientRect?.();
      if (!rect || !container) return;
      void computePosition(
        {
          getBoundingClientRect: () => rect,
          contextElement: document.body,
        },
        container,
        { placement: 'bottom-start', middleware: [offset(6), flip(), shift({ padding: 8 })] }
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
        container.style.position = 'absolute';
        container.style.zIndex = '50';
        container.appendChild(component.element);
        document.body.appendChild(container);
        place(props.clientRect);

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
        place(props.clientRect);
      },

      onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,

      onExit: () => {
        if (closeOnEscape) window.removeEventListener('keydown', closeOnEscape, { capture: true });
        closeOnEscape = null;
        container?.remove();
        component?.destroy();
        container = null;
        component = null;
      },
    };
  };
}
