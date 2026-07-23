import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from './deps';

const MIME_PREFIX: Partial<Record<AttachmentKind, string>> = {
  image: 'image/',
  audio: 'audio/',
  video: 'video/',
};

/** Validate -> createAttachment -> insert node, for each file matching the
 *  kind's MIME prefix. One getNoteId() per batch (a draft persists once).
 *  insertNode inserts the kind's TipTap node for a new attachment id. */
export async function insertAttachmentFiles(
  _editor: Editor,
  files: FileList | File[],
  kind: AttachmentKind,
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const prefix = MIME_PREFIX[kind];
  if (!prefix) return;
  const matched = Array.from(files).filter((f) => f.type.startsWith(prefix));
  if (matched.length === 0) return;
  const noteId = await deps.getNoteId();
  for (const file of matched) {
    try {
      const att = await deps.createAttachment(noteId, file, kind);
      insertNode(att.id);
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        console.error('insertAttachmentFiles: failed to add attachment', err);
        deps.onError('insert-failed');
      }
    }
  }
}

/** Clone-on-insert for foreign attachments (cross-note copy/paste). Any
 *  attachment node (image or audio) whose row is owned by another note is
 *  re-pointed at a fresh owned clone; every node sharing an old id is rewritten. */
export async function dedupeForeignAttachments(
  editor: Editor,
  deps: AttachmentDeps
): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    const att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue;
    const clone = await deps.cloneAttachment(att, noteId);
    const positions: number[] = [];
    editor.state.doc.descendants((node, p) => {
      if (node.attrs.attachmentId === id) positions.push(p);
      return true;
    });
    if (positions.length > 0) {
      editor
        .chain()
        .command(({ tr }) => {
          for (const p of positions) tr.setNodeAttribute(p, 'attachmentId', clone.id);
          return true;
        })
        .run();
    }
  }
}
