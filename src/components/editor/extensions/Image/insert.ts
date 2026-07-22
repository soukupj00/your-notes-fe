import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError } from '@/lib/attachments.ts';
import type { ImageDeps } from './Image';

/** Validate → createAttachment → insert node, for each image file. One
 *  getNoteId() call covers the whole batch (a draft persists once). */
export async function insertImageFiles(
  editor: Editor,
  files: FileList | File[],
  deps: ImageDeps
): Promise<void> {
  const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (images.length === 0) return;
  const noteId = await deps.getNoteId();
  for (const file of images) {
    try {
      const att = await deps.createAttachment(noteId, file);
      editor.chain().focus().insertImageAttachment({ attachmentId: att.id }).run();
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        // Non-validation failure (e.g. a Dexie write error). Every caller does
        // `void insertImageFiles(...)`, so rethrowing here would become an
        // unhandled rejection with no user-visible feedback. Surface a generic
        // toast and keep processing the rest of the batch instead of aborting.
        console.error('insertImageFiles: failed to add image', err);
        deps.onError('insert-failed');
      }
    }
  }
}

/** Clone-on-insert for foreign images (cross-note copy/paste). After a paste,
 *  any imageAttachment node whose row is owned by another Note is re-pointed at
 *  a fresh owned clone, so every row belongs to exactly one Note and the GC
 *  sweep stays trivial. Lowest-frequency path; runs async after paste applies. */
export async function dedupeForeignImages(editor: Editor, deps: ImageDeps): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    const att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue; // missing → NodeView shows broken; owned → keep
    const clone = await deps.cloneAttachment(att, noteId);
    // Two pasted nodes can share the SAME foreign id (e.g. one image pasted
    // twice), so every node still carrying the old id must be re-pointed to
    // this one clone - not just the first. Collect all matching positions from
    // a fresh doc walk, then rewrite them within a single transaction/command
    // so positions don't shift out from under later setNodeAttribute calls
    // (they're independent per-node attribute writes, not structural edits).
    const positions: number[] = [];
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === 'imageAttachment' && node.attrs.attachmentId === id) {
        positions.push(p);
      }
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
