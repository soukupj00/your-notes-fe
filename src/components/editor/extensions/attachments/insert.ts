import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from './deps';

/** Derived data computed from the file before it is stored, or nothing. */
export type DerivedAttachmentData = {
  thumbnail?: Blob;
  duration?: number;
  /** Pixels, so another Device can reserve the box before the bytes arrive (M5 slice 5). */
  width?: number;
  height?: number;
};

/**
 * `deps` with a `createAttachment` that validates the file and derives its card
 * metadata in the same step that stores it.
 *
 * Image and video both need this - a picture wants a thumbnail, a clip wants a
 * poster frame and its length - and both need it *atomically* with the write, so
 * a row can never exist without the preview the feed expects. `deriveData` is
 * the only difference between them, and it is best-effort by contract: whatever
 * it fails to produce it simply omits, and the attachment is stored regardless.
 */
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
      // Whatever could not be derived is left off entirely rather than passed as
      // an explicit `undefined`: the options argument says "here is extra data",
      // and a key with nothing behind it is not that.
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
