import { type ChainedCommands, type Editor, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import type { ComponentType } from 'react';
import type { AnyButtonView, TFunction } from '../button-types';
import type { AttachmentDeps } from './deps';

export interface AttachmentNodeConfig {
  name: string;
  parseTag: string;
  /** renderHTML tag, e.g. 'img'. No src is ever emitted (ADR 0007). */
  renderTag: string;
  insertCommandName: string;
  nodeView: ComponentType<ReactNodeViewProps>;
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => AnyButtonView;
}

/** The node mechanics every media attachment shares; per-type parts come from config.
 *  Deps are read through `getDeps`, so the button and node view always see live ones. */
export function createAttachmentNode(getDeps: () => AttachmentDeps, config: AttachmentNodeConfig) {
  return Node.create({
    name: config.name,
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
      return {
        getDeps,
        button: ({ editor, t }: { editor: Editor; t: TFunction }) =>
          config.button({ editor, getDeps, t }),
      };
    },

    addAttributes() {
      return {
        attachmentId: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-attachment-id'),
          renderHTML: (attrs: { attachmentId?: string | null }) =>
            attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: config.parseTag }];
    },

    renderHTML({ HTMLAttributes }) {
      return [config.renderTag, mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(config.nodeView);
    },

    addCommands() {
      const name = this.name;
      const command =
        (attrs: { attachmentId: string }) =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain()
            .insertContent({ type: name, attrs })
            // A block atom keeps a NodeSelection on itself, so the next insert replaced it and
            // only the last of several files survived. Move the cursor past it, adding a
            // paragraph at the document end. Mirrors TipTap's own HorizontalRule.
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                const posAfter = $to.end();
                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
                  } else {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos));
                  }
                } else {
                  const node = $to.parent.type.contentMatch.defaultType?.create();
                  if (node) {
                    tr.insert(posAfter, node);
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
                  }
                }
                tr.scrollIntoView();
              }
              return true;
            })
            .run();
      return { [config.insertCommandName]: command };
    },
  });
}
