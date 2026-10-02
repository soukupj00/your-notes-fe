import { type ChainedCommands, type Editor, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import type { ComponentType } from 'react';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import { ATTACHMENT_ID_ATTR } from '@/lib/body.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AnyButtonView, TFunction } from '../button-types';
import type { AttachmentDeps } from './deps';

export interface AttachmentNodeConfig {
  kind: AttachmentKind;
  nodeView: ComponentType<ReactNodeViewProps>;
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => AnyButtonView;
}

/** The insert command of each kind, as the extension files declare them for TipTap's typing.
 *  The type pins each value to its own kind, so a copied row cannot register another kind's command. */
export const INSERT_COMMAND = {
  image: 'insertImageAttachment',
  audio: 'insertAudioAttachment',
  video: 'insertVideoAttachment',
  file: 'insertFileAttachment',
  excalidraw: 'insertExcalidrawAttachment',
} as const satisfies {
  [K in AttachmentKind]: `insert${Capitalize<K>}Attachment` & keyof ChainedCommands;
};

/** Places a node for a stored row at the selection. */
export function insertAttachmentNode(
  editor: Editor,
  kind: AttachmentKind,
  attachmentId: string
): boolean {
  return editor.chain().focus()[INSERT_COMMAND[kind]]({ attachmentId }).run();
}

/** The node mechanics every attachment kind shares; the per-kind parts come from the kind's spec
 *  and the config. Deps are read through `getDeps`, so the button and node view see live ones. */
export function createAttachmentNode(getDeps: () => AttachmentDeps, config: AttachmentNodeConfig) {
  const { tag } = ATTACHMENT_SPECS[config.kind];
  return Node.create({
    name: `${config.kind}Attachment`,
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
          parseHTML: (el: HTMLElement) => el.getAttribute(ATTACHMENT_ID_ATTR),
          renderHTML: (attrs: { attachmentId?: string | null }) =>
            attrs.attachmentId ? { [ATTACHMENT_ID_ATTR]: attrs.attachmentId } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: `${tag}[${ATTACHMENT_ID_ATTR}]` }];
    },

    // No src, href or payload is ever emitted (ADR 0007).
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes)];
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
      return { [INSERT_COMMAND[config.kind]]: command };
    },
  });
}
