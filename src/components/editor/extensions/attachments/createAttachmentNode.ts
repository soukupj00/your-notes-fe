import { type ChainedCommands, type Editor, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import type { ComponentType } from 'react';
import type { TFunction } from '../button-types';
import type { AttachmentDeps } from './deps';

export interface AttachmentNodeConfig {
  /** TipTap node name, e.g. 'imageAttachment'. */
  name: string;
  /** parseHTML tag selector, e.g. 'img[data-attachment-id]'. */
  parseTag: string;
  /** renderHTML tag, e.g. 'img'. No src is ever emitted (ADR 0007). */
  renderTag: string;
  /** Command name that inserts this node, e.g. 'insertImageAttachment'. */
  insertCommandName: string;
  nodeView: ComponentType<ReactNodeViewProps>;
  /** Pattern A button factory (custom component). */
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => unknown;
}

/**
 * Shared TipTap node mechanics for every media attachment (image, audio, ...):
 * one `attachmentId` attribute, id-only parse/render (no src), the getDeps
 * stable-getter option wiring (so the toolbar button/NodeView read live deps -
 * Slice 1's frozen-deps fix), a React NodeView, and an insert command. Per-type
 * concerns (tag, NodeView, button, command name) come from config.
 */
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
            // A block atom leaves a NodeSelection on itself after insertContent.
            // Without a cursor after it, the next insert (the picker loop or a
            // second file) replaces the selected node instead of appending, so
            // only the last attachment survived. Drop the selection after the
            // node - adding a trailing paragraph when it lands at the document
            // end - so attachments stack. Mirrors TipTap's own HorizontalRule.
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
