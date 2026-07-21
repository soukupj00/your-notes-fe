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
      if (err instanceof AttachmentError) deps.onError(err.code);
      else throw err;
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
    // Re-point the first node still carrying the old id. Re-scan each pass since
    // positions shift; we only rewrite one occurrence per clone.
    let pos: number | null = null;
    editor.state.doc.descendants((node, p) => {
      if (pos === null && node.type.name === 'imageAttachment' && node.attrs.attachmentId === id) {
        pos = p;
        return false;
      }
      return true;
    });
    if (pos !== null) {
      editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeAttribute(pos as number, 'attachmentId', clone.id);
          return true;
        })
        .run();
    }
  }
}
