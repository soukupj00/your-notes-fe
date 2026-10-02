import type { Editor } from '@tiptap/core';
import { AttachmentError, fileMatchesKind, validateAttachmentFile } from '@/lib/attachments.ts';
import { extractAttachmentIds } from '@/lib/body.ts';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { NewAttachmentOptions } from '@/lib/rows.ts';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { AttachmentKind } from '@/models.ts';
import { insertAttachmentNode } from './createAttachmentNode';
import type { AttachmentDeps } from './deps';

/** What a kind derives from its bytes at insert, so a row never exists without the Preview the
 *  card expects. Best-effort: what cannot be produced is omitted and the file is stored anyway. */
const DERIVE: Partial<Record<AttachmentKind, (file: File) => Promise<NewAttachmentOptions>>> = {
  image: generateImageThumbnail,
  video: async (file) => {
    const { poster, ...metadata } = await generateVideoPoster(file);
    return { thumbnail: poster, ...metadata };
  },
};

/** The kinds a paste or drop is routed to. */
const TRANSFER_KINDS: AttachmentKind[] = ['image', 'audio', 'video'];

async function createWithDerivedData(
  deps: AttachmentDeps,
  noteId: string,
  file: File,
  kind: AttachmentKind
) {
  // Validated before the decode, so a rejected file never pays for one it was going to throw away.
  const bad = validateAttachmentFile(file, kind);
  if (bad) throw new AttachmentError(bad);
  const derived = (await DERIVE[kind]?.(file)) ?? {};
  // The options mean "here is extra data", so empty keys are left off.
  const options = Object.fromEntries(
    Object.entries(derived).filter(([, value]) => value !== undefined)
  ) as NewAttachmentOptions;
  return deps.createAttachment(noteId, file, kind, options);
}

function reportInsertError(deps: AttachmentDeps, kind: AttachmentKind, err: unknown) {
  if (err instanceof AttachmentError) {
    deps.onError(err.code, kind);
  } else {
    console.error('insertFiles: failed to add attachment', err);
    deps.onError('insert-failed', kind);
  }
}

/** The one path from files to nodes: files of the kind are validated, derived from, stored and
 *  placed. One `getNoteId()` per batch, so a draft is persisted once for several files. */
export async function insertFiles(
  kind: AttachmentKind,
  editor: Editor,
  files: Iterable<File>,
  deps: AttachmentDeps
): Promise<void> {
  const matched = Array.from(files).filter((file) => fileMatchesKind(file, kind));
  if (matched.length === 0) return;
  let noteId: string;
  try {
    noteId = await deps.getNoteId();
  } catch (err) {
    // Every caller fires this with `void`, so a rejection left here would vanish untoasted.
    reportInsertError(deps, kind, err);
    return;
  }
  for (const file of matched) {
    try {
      const att = await createWithDerivedData(deps, noteId, file, kind);
      insertAttachmentNode(editor, kind, att.id);
    } catch (err) {
      reportInsertError(deps, kind, err);
    }
  }
}

/** Paste or drop: each file goes to its kind, so a mixed transfer loses nothing. `false` leaves
 *  a transfer no media kind claims to the browser. */
export function insertTransferredFiles(
  editor: Editor,
  files: FileList,
  deps: AttachmentDeps
): boolean {
  const list = Array.from(files);
  const kinds = TRANSFER_KINDS.filter((kind) => list.some((file) => fileMatchesKind(file, kind)));
  for (const kind of kinds) void insertFiles(kind, editor, list, deps);
  return kinds.length > 0;
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
