import { strFromU8, strToU8, type Unzipped, unzip, type Zippable, zip } from 'fflate';
import { z } from 'zod';
import type { LocalStore } from '@/data/LocalStore.ts';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';

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

// Rows are validated *loosely*: the fields below are the ones a restore cannot
// work without (keys, the indexed `state`, timestamps), and everything else
// passes through untouched. That way a backup taken after a future model gains
// a field still restores it, instead of the schema quietly dropping it.
const noteSchema = z.looseObject({
  id: z.string(),
  state: z.enum(['active', 'archived', 'trashed']),
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
 * Snapshots the whole database into a zip: one `manifest.json` holding every
 * row, plus one entry per attachment blob.
 *
 * Blobs stay out of the manifest deliberately - base64 inside JSON would cost a
 * third more space and force the entire (potentially hundreds of MB) payload
 * through a single string. They are also stored uncompressed, because PNG/WebM
 * bytes are already compressed and deflating them again only burns CPU.
 */
export async function buildBackupZip(store: LocalStore): Promise<Blob> {
  const { notes, tags, noteTags, attachments } = await store.exportAll();

  const entries: Zippable = {};
  const attachmentMeta = [];

  // Every blob read is independent, so they run together rather than paying
  // each read's latency in series. Peak memory is unchanged - the bytes all had
  // to be resident in `entries` before zipping either way. The writes are then
  // replayed in table order, so an archive's layout stays deterministic.
  const read = await Promise.all(
    attachments.map(async ({ blob, thumbnail, ...meta }) => ({
      meta,
      blobBytes: await bytesOf(blob),
      thumbnailBytes: thumbnail ? await bytesOf(thumbnail) : undefined,
    }))
  );

  for (const { meta, blobBytes, thumbnailBytes } of read) {
    entries[blobPath(meta.id)] = [blobBytes, { level: 0 }];
    if (thumbnailBytes) {
      entries[thumbnailPath(meta.id)] = [thumbnailBytes, { level: 0 }];
    }
    attachmentMeta.push({ ...meta, hasThumbnail: Boolean(thumbnailBytes) });
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
 * Validates a backup end to end *without touching the database*. Restore is
 * replace-all, so every possible rejection - unreadable zip, bad manifest,
 * attachment bytes the manifest promised but the zip lacks - has to surface
 * here, while the user's current data is still intact.
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
    if (!files[blobPath(attachment.id)]) throw new BackupError('missing-attachment');
    if (attachment.hasThumbnail && !files[thumbnailPath(attachment.id)]) {
      throw new BackupError('missing-attachment');
    }
  }

  return { manifest: parsed.data, files };
}

/**
 * Replace-all restore: wipes the store and writes the backup's rows
 * atomically, so a failure part-way through rolls back to the data the user
 * had rather than leaving a half-restored database.
 *
 * `manifest.settings` is a leftover from before Preferences left the store
 * (ADR 0020, see `buildBackupZip`); it is read here and ignored.
 *
 * Only ever call this with the output of `parseBackupZip` - it assumes the
 * backup has already been validated.
 */
export async function restoreBackup(
  store: LocalStore,
  { manifest, files }: ParsedBackup
): Promise<void> {
  const attachments: Attachment[] = manifest.attachments.map((meta) => {
    const { hasThumbnail, ...rest } = meta;
    const thumbnailBytes = hasThumbnail ? files[thumbnailPath(meta.id)] : undefined;
    return {
      // The loose schemas keep unknown fields as `unknown`, which no longer
      // structurally matches the model; the shape was validated above.
      ...(rest as unknown as Omit<Attachment, 'blob' | 'thumbnail'>),
      blob: new Blob([toBlobPart(files[blobPath(meta.id)])], { type: meta.mime }),
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
   * True when the browser told us where the bytes go, so a resolved `write`
   * really means the file landed. False on the anchor fallback, where the save
   * is fire-and-forget - callers must not claim success on that path.
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
 * Asks the user where a file should go, **before** it has been built.
 *
 * Order matters twice. `showSaveFilePicker` needs the click's user activation,
 * which awaiting a multi-second zip would spend; and for the import safety copy
 * this call is the last point where a cancel can still abandon the whole
 * operation without anything having been touched.
 *
 * Returns null when the user cancelled. Where the API is missing the file is
 * simply downloaded and the target reports `confirmed: false`, because a plain
 * anchor download gives us no completion or cancellation signal at all.
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
