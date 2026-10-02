import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from './deps';

export type DerivedAttachmentData = {
  thumbnail?: Blob;
  duration?: number;
  /** Pixels, so another Device can reserve the box before the bytes arrive (M5 slice 5). */
  width?: number;
  height?: number;
};

/** Derives card data (thumbnail, poster, length) in the same step as the write, so a row
 *  never exists without the preview the feed expects. `deriveData` is best-effort: what it
 *  cannot produce is omitted and the attachment is stored anyway. */
export function withDerivedAttachmentData(
  deps: AttachmentDeps,
  kind: AttachmentKind,
  deriveData: (file: File) => Promise<DerivedAttachmentData>
): AttachmentDeps {
  return {
    ...deps,
    createAttachment: async (noteId, file, fileKind) => {
      // Validated here rather than inside `deriveData`, so a rejected file never
      // pays for a decode it was always going to throw away.
      const validationError = validateAttachmentFile(file, kind);
      if (validationError) throw new AttachmentError(validationError);
      const derived = await deriveData(file);
      // The options argument means "here is extra data", so empty keys are left off.
      const options = Object.fromEntries(
        Object.entries(derived).filter(([, value]) => value !== undefined)
      ) as DerivedAttachmentData;
      return Object.keys(options).length > 0
        ? deps.createAttachment(noteId, file, fileKind, options)
        : deps.createAttachment(noteId, file, fileKind);
    },
  };
}

const MIME_PREFIX: Partial<Record<AttachmentKind, string>> = {
  image: 'image/',
  audio: 'audio/',
  video: 'video/',
};

/** One getNoteId() per batch, so a draft is persisted once for several files. */
export async function insertAttachmentFiles(
  _editor: Editor,
  files: FileList | File[],
  kind: AttachmentKind,
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const prefix = MIME_PREFIX[kind];
  // `file` has no single MIME prefix: accept any picked file (the size cap in
  // validateAttachmentFile gates it). Media kinds still filter by their prefix.
  const matched =
    kind === 'file'
      ? Array.from(files)
      : prefix
        ? Array.from(files).filter((f) => f.type.startsWith(prefix))
        : [];
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

/** Cross-note paste: every node whose row another note owns is repointed at a fresh
 *  clone this note owns. */
export async function dedupeForeignAttachments(
  editor: Editor,
  deps: AttachmentDeps
): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    let att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue;
    // A clone takes a new id, and only this Device could ever upload bytes under it.
    if (!att.blob && (await deps.downloadAttachment(id).catch(() => false))) {
      att = (await deps.getAttachment(id)) ?? att;
    }
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
