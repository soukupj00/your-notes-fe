import { mergeAttributes, Node } from '@tiptap/core';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import type { Attachment } from '@/models.ts';
import type { TFunction } from '../button-types';
import { ImageButton } from './ImageButton';

export interface ImageDeps {
  getNoteId: () => Promise<string>;
  createAttachment: (noteId: string, file: File) => Promise<Attachment>;
  getAttachment: (id: string) => Promise<Attachment | undefined>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageAttachment: {
      insertImageAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/**
 * Custom inline-image node (M3 Slice 1). Unlike @tiptap/extension-image it
 * persists NO src - only `data-attachment-id`, resolved to a Blob object URL by
 * the NodeView (editor) and <NoteBody> (read-only). Built via a factory so the
 * data-layer deps (from the dialog + useAttachmentActions) reach the button,
 * paste/drop pipeline, and NodeView - mirrors createMathematics in editor.tsx.
 */
export function createImage(deps: ImageDeps) {
  return Node.create({
    name: 'imageAttachment',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
      return {
        // Deps are read by the NodeView (Task 6) and the button below.
        deps,
        button: ({ editor, t }: { editor: import('@tiptap/core').Editor; t: TFunction }) => ({
          component: ImageButton,
          componentProps: { editor, deps, tooltip: t('editor.image.tooltip') },
        }),
      };
    },

    addAttributes() {
      return {
        attachmentId: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-attachment-id'),
          renderHTML: (attrs) =>
            attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: 'img[data-attachment-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
      // No src ever - the id is the only persisted reference (ADR 0007).
      return ['img', mergeAttributes(HTMLAttributes)];
    },

    addCommands() {
      const name = this.name;
      return {
        insertImageAttachment:
          (attrs) =>
          ({ commands }) =>
            commands.insertContent({ type: name, attrs }),
      };
    },
  });
}
