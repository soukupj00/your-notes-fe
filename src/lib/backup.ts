import { strFromU8, strToU8, type Unzipped, unzip, type Zippable, zip } from 'fflate';
import { z } from 'zod';
import type { LocalStore } from '@/data/LocalStore.ts';
import { type Attachment, NOTE_STATES, type Note, type NoteTag, type Tag } from '@/models.ts';

/**
 * Backup format version. Bump it only when the *layout* changes (entry naming,
 * manifest shape) in a way this reader cannot absorb; adding a field to a row
 * does not need a bump, because rows are validated loosely (see below).
 */
export const BACKUP_VERSION = 1;

export const BACKUP_MANIFEST_NAME = 'manifest.json';
const ATTACHMENTS_DIR = 'attachments/';
const THUMBNAIL_SUFFIX = '.thumb';

const blobPath = (id: string) => `${ATTACHMENTS_DIR}${id}`;
const thumbnailPath = (id: string) => `${ATTACHMENTS_DIR}${id}${THUMBNAIL_SUFFIX}`;

export type BackupErrorCode =
  | 'invalid-zip'
  | 'missing-manifest'
  | 'invalid-manifest'
  | 'unsupported-version'
  | 'missing-attachment';

/** Thrown by `parseBackupZip`; the code maps to a translated toast. */
export class BackupError extends Error {
  code: BackupErrorCode;

  constructor(code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
  }
}

// Loose: only the fields a restore cannot work without are checked, and everything else passes
// through, so a field a future model gains survives a restore instead of being dropped.
const noteSchema = z.looseObject({
  id: z.string(),
  state: z.enum(NOTE_STATES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const tagSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const noteTagSchema = z.looseObject({
  noteId: z.string(),
  tagId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** An attachment minus its bytes - those are separate zip entries. */
const attachmentMetaSchema = z.looseObject({
  id: z.string(),
  noteId: z.string(),
  kind: z.string(),
  mime: z.string(),
  /** True when `attachments/<id>.thumb` must also be present. */
  hasThumbnail: z.boolean().optional(),
  /**
   * False for a row synced from another Device whose bytes were never downloaded
   * (M5 slice 5): no `attachments/<id>` entry, and the server still has them.
   * Absent in archives made before, which always carried the bytes.
   */
  hasBlob: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const settingSchema = z.object({ key: z.string(), value: z.unknown() });

const manifestSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  notes: z.array(noteSchema),
  tags: z.array(tagSchema),
  noteTags: z.array(noteTagSchema),
  attachments: z.array(attachmentMetaSchema),
  settings: z.array(settingSchema),
});

/**
 * The manifest *as read back*. Its row types come from the loose schemas, so
 * they carry an index signature and are deliberately not `Note`/`Tag`/... - a
 * restored row is only known to have the fields validated above.
 */
export type BackupManifest = z.infer<typeof manifestSchema>;

/** Turns fflate's `Uint8Array<ArrayBufferLike>` into a Blob-safe view. */
function toBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.slice().buffer as ArrayBuffer;
}

/** A validated backup, ready for `restoreBackup` - nothing has been written yet. */
export interface ParsedBackup {
  manifest: BackupManifest;
  /** Attachment bytes keyed by zip entry path. */
  files: Unzipped;
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Blobs are their own zip entries, not base64 in the manifest, which would cost a third more and
 * force hundreds of MB through one string. They are stored uncompressed, as media already is.
 */
export async function buildBackupZip(store: LocalStore): Promise<Blob> {
  const { notes, tags, noteTags, attachments } = await store.exportAll();

  const entries: Zippable = {};
  const attachmentMeta = [];

  // Read in parallel: every byte must be resident before zipping anyway, so peak memory is the
  // same. Entries are then written in table order, so the archive layout stays deterministic.
  const read = await Promise.all(
    attachments.map(async ({ blob, thumbnail, ...meta }) => ({
      meta,
      blobBytes: blob ? await bytesOf(blob) : undefined,
      thumbnailBytes: thumbnail ? await bytesOf(thumbnail) : undefined,
    }))
  );

  for (const { meta, blobBytes, thumbnailBytes } of read) {
    if (blobBytes) entries[blobPath(meta.id)] = [blobBytes, { level: 0 }];
    if (thumbnailBytes) {
      entries[thumbnailPath(meta.id)] = [thumbnailBytes, { level: 0 }];
    }
    attachmentMeta.push({
      ...meta,
      hasThumbnail: Boolean(thumbnailBytes),
      hasBlob: Boolean(blobBytes),
    });
  }

  // Not annotated as BackupManifest: that type describes the *parsed* shape,
  // whose loosely-validated rows are a wider type than the models we write.
  const manifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    tags,
    noteTags,
    attachments: attachmentMeta,
    // Preferences left the store in ADR 0020; kept as an empty array so the
    // manifest shape (and every archive written before) still validates.
    settings: [],
  };

  entries[BACKUP_MANIFEST_NAME] = [strToU8(JSON.stringify(manifest)), { level: 6 }];

  return new Blob([toBlobPart(await zipAsync(entries))], { type: 'application/zip' });
}

/**
 * The only validation gate, and it never writes: restore is replace-all, so every rejection has
 * to surface here while the user's current data is still intact.
 */
export async function parseBackupZip(data: Uint8Array): Promise<ParsedBackup> {
  let files: Unzipped;
  try {
    files = await unzipAsync(data);
  } catch {
    throw new BackupError('invalid-zip');
  }

  const manifestBytes = files[BACKUP_MANIFEST_NAME];
  if (!manifestBytes) throw new BackupError('missing-manifest');

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new BackupError('invalid-manifest');
  }

  // Read the version before the full schema, so a newer backup gets the honest
  // "made by a newer version" message instead of a generic parse failure.
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    throw new BackupError('unsupported-version');
  }

  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new BackupError('invalid-manifest');

  for (const attachment of parsed.data.attachments) {
    if (attachment.hasBlob !== false && !files[blobPath(attachment.id)]) {
      throw new BackupError('missing-attachment');
    }
    if (attachment.hasThumbnail && !files[thumbnailPath(attachment.id)]) {
      throw new BackupError('missing-attachment');
    }
  }

  return { manifest: parsed.data, files };
}

/**
 * Atomic replace-all, so a failure part-way rolls back to the user's data. Only call it with
 * `parseBackupZip`'s output, as it trusts that validation. `manifest.settings` is ignored
 * (ADR 0020).
 */
export async function restoreBackup(
  store: LocalStore,
  { manifest, files }: ParsedBackup
): Promise<void> {
  const attachments: Attachment[] = manifest.attachments.map((meta) => {
    const { hasThumbnail, hasBlob, ...rest } = meta;
    const thumbnailBytes = hasThumbnail ? files[thumbnailPath(meta.id)] : undefined;
    const blobBytes = hasBlob === false ? undefined : files[blobPath(meta.id)];
    return {
      // The loose schemas keep unknown fields as `unknown`, which no longer
      // structurally matches the model; the shape was validated above.
      ...(rest as unknown as Omit<Attachment, 'blob' | 'thumbnail'>),
      ...(blobBytes ? { blob: new Blob([toBlobPart(blobBytes)], { type: meta.mime }) } : {}),
      ...(thumbnailBytes ? { thumbnail: new Blob([toBlobPart(thumbnailBytes)]) } : {}),
    };
  });

  await store.replaceAll({
    notes: manifest.notes as unknown as Note[],
    tags: manifest.tags as unknown as Tag[],
    noteTags: manifest.noteTags as unknown as NoteTag[],
    attachments,
  });
}

/** `ruflo-backup-2026-07-28-1042.zip` - sortable, and unique enough per minute. */
export function backupFilename(suffix = '', now = new Date()): string {
  const [date, time] = now.toISOString().split('T');
  return `ruflo-backup-${date}-${time.slice(0, 5).replace(':', '')}${suffix}.zip`;
}

/** Hands a Blob to the browser as a download. Fire-and-forget: the browser may
 *  still show its own "where to save?" dialog, and we never hear the outcome. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A place the user has agreed to put a file. */
export interface SaveTarget {
  write(blob: Blob): Promise<void>;
  /**
   * False on the anchor fallback, where the save is fire-and-forget: callers must not claim the
   * file landed. True means a resolved `write` really did save it.
   */
  confirmed: boolean;
}

// The slice of the File System Access API we use. Not in TypeScript's DOM lib,
// and absent in Firefox/Safari, hence the fallback below.
interface FileSystemWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
type ShowSaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<FileSystemWritable> }>;

const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';

/**
 * Asks where the file goes before it is built: the picker needs the click's user activation, and
 * a cancel here (null) still abandons an import untouched. Without the API it just downloads.
 */
export async function requestSaveTarget(filename: string): Promise<SaveTarget | null> {
  const fallback: SaveTarget = {
    confirmed: false,
    write: async (blob) => downloadBlob(blob, filename),
  };

  const picker = (globalThis as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (!picker) return fallback;

  try {
    const handle = await picker({
      suggestedName: filename,
      types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }],
    });
    return {
      confirmed: true,
      write: async (blob) => {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      },
    };
  } catch (error) {
    // A deliberate cancel is the caller's business; anything else (the picker
    // refused, e.g. inside a sandboxed frame) is not worth failing over.
    if (isAbort(error)) return null;
    return fallback;
  }
}
