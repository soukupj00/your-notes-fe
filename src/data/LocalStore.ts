import type { Attachment, Note, NoteState, NoteTag, Tag } from '@/models.ts';
import type { Live } from './live.ts';
import type { PushBatch, PushOutcome, ServerChanges } from './Remote.ts';

/**
 * Which slice of the library a view is showing. `state` maps one-to-one onto a
 * route (`/` -> active, `/archive` -> archived, `/trash` -> trashed); `tagId`
 * narrows it further for `/tag/$id`.
 */
export type NoteFeedScope = {
  state: NoteState;
  tagId?: string;
};

export type NoteUpdate = { before: Note; after: Note };

/** What `notes.purge` removed alongside the note, for a lossless undo. */
export type PurgedRelations = { removedTags: NoteTag[]; removedAttachments: Attachment[] };

/**
 * Never `blob`: bytes are write-once by id (ADR 0017), so new bytes are a new row and
 * downloaded ones arrive through `sync.received`. A new thumbnail needs a new `thumbnailId`.
 */
export type AttachmentChanges = Partial<Pick<Attachment, 'preview' | 'duration' | 'updatedAt'>> &
  ({ thumbnail?: never; thumbnailId?: string } | { thumbnail: Blob; thumbnailId: string });

/** An Attachment row with what Sync needs to move its bytes (M5 slice 5). */
export type AttachmentTransfer = {
  attachment: Attachment;
  /** Its Note has a Revision, so the server knows it and its bytes may go up. */
  noteOnServer: boolean;
  /** The blob ids (its own, its `thumbnailId`) the server is known to hold. */
  onServer: readonly string[];
  /** The server refused its bytes for their size; nothing retries it. */
  tooLarge: boolean;
};

/** Everything a Backup carries. `meta` is deliberately not part of it. */
export type Snapshot = {
  notes: Note[];
  tags: Tag[];
  noteTags: NoteTag[];
  attachments: Attachment[];
};

export const SYNC_META_KEYS = {
  /** The opaque `_links.next` URL the server last handed out. */
  cursor: 'sync.cursor',
  /** ISO time of the last completed pull. */
  lastSyncedAt: 'sync.lastSyncedAt',
  /** The Account this database is attached to; what makes erase-on-sign-out enforceable. */
  accountId: 'sync.accountId',
  /** The Account's Sequence at the last pull; a Live Update hint past it is news. */
  seq: 'sync.seq',
} as const;

/**
 * How `sync.applyPage` treats a row this Device still owes. `keep-local` (a pull)
 * leaves an owed row or one with a pending Tombstone alone, so the next push
 * decides it; `server-wins` (resolving a push outcome) overwrites it.
 */
export type ApplyMode = 'keep-local' | 'server-wins';

/**
 * The only way app code reads or writes persisted data (ADR 0020). Its rules are in
 * src/data/CLAUDE.md and `localStore.contract.ts` checks them.
 * A `Live` may over-deliver but must never miss a write that changed its value.
 */
export interface LocalStore {
  readonly notes: {
    get(id: string): Promise<Note | undefined>;
    list(): Promise<Note[]>;
    listByState(state: NoteState): Promise<Note[]>;
    /** Notes whose `trashedAt` is older than `cutoff` (ISO), whatever their state. */
    listTrashedBefore(cutoff: string): Promise<Note[]>;
    /** Live, scoped, each note carrying its `tags`. */
    feed(scope: NoteFeedScope): Live<Note[]>;
    add(note: Note): Promise<void>;
    put(note: Note): Promise<void>;
    /** Atomic read-modify-write; `null` when there is no such note. */
    update(id: string, change: (note: Note) => Partial<Note>): Promise<NoteUpdate | null>;
    /** Removes the note, its links and its attachments, and returns the latter two. */
    purge(id: string): Promise<PurgedRelations>;
    /** The inverse of `purge`: puts the note and whatever was removed back verbatim. */
    restore(note: Note, removed?: Partial<PurgedRelations>): Promise<void>;
  };

  readonly tags: {
    get(id: string): Promise<Tag | undefined>;
    watch(id: string): Live<Tag | undefined>;
    list(): Promise<Tag[]>;
    all(): Live<Tag[]>;
    /** Case-insensitive, exact after trimming. */
    findByName(name: string): Promise<Tag | undefined>;
    add(tag: Tag): Promise<void>;
    put(tag: Tag): Promise<void>;
    /** Atomic read-modify-write; `null` when there is no such tag. */
    update(id: string, change: (tag: Tag) => Partial<Tag>): Promise<Tag | null>;
    /** Deletes the tag and every link to it. */
    delete(id: string): Promise<void>;
    /**
     * Every note labelled `sourceId` comes out labelled `targetId`, notes that
     * carried both keep one link, and the source is deleted. Atomic. Throws if
     * the target does not exist. Merging a tag into itself changes nothing.
     */
    merge(sourceId: string, targetId: string): Promise<void>;
    forNote(noteId: string): Live<Tag[]>;
    /** Idempotent on `[noteId+tagId]`: an existing link is left as it is. */
    link(link: NoteTag): Promise<void>;
    unlink(noteId: string, tagId: string): Promise<void>;
    listLinks(): Promise<NoteTag[]>;
  };

  readonly attachments: {
    get(id: string): Promise<Attachment | undefined>;
    watch(id: string): Live<Attachment | undefined>;
    list(): Promise<Attachment[]>;
    forNote(noteId: string): Live<Attachment[]>;
    forNotes(noteIds: readonly string[]): Live<Attachment[]>;
    add(attachment: Attachment): Promise<void>;
    update(id: string, changes: AttachmentChanges): Promise<void>;
    delete(id: string): Promise<void>;
    /** Deletes this note's rows whose id is not in `keep`; returns how many. */
    sweepNote(noteId: string, keep: readonly string[]): Promise<number>;
    /**
     * Deletes every row whose owning note is gone or whose owner no longer
     * references it, in one pass; returns how many. `referencedBy` reads the
     * ids out of a note (the caller knows the Body's markup, the store does not).
     */
    sweepAll(referencedBy: (note: Note) => Iterable<string>): Promise<number>;
  };

  /** Bookkeeping about the store's own rows. Preferences live with the Device (CONTEXT.md). */
  readonly meta: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };

  /** What the server is owed; only the sync engine calls these (M5 slice 4). */
  readonly sync: {
    /**
     * Every owed row in the contract's push shape, and every pending Tombstone.
     * A Note carries its Attachment metadata (never bytes) and not its `tags`
     * join. Not chunked: the engine splits it to `MAX_BATCH`.
     */
    dirty(): Promise<PushBatch>;
    /**
     * Records the `accepted` outcomes: a row takes its new Revision and stops being owed unless
     * it changed mid-push, and an accepted Tombstone is dropped. `conflict` and `gone` are the
     * engine's to resolve. Throws if the counts do not pair up.
     */
    applied(batch: PushBatch, outcomes: readonly PushOutcome[]): Promise<void>;
    /**
     * Writes the server's rows atomically, with its Revisions and not owed (`ApplyMode` covers owed
     * rows). Tombstones and a Note's `attachments` follow the rules in src/data/CLAUDE.md.
     */
    applyPage(changes: ServerChanges, mode?: ApplyMode): Promise<void>;
    /**
     * Before a full resync (a 410): drops every Note, Tag and NoteTag that is not
     * owed. Owed rows, Tombstones and every Attachment row stay, so a Note that
     * comes back finds its bytes.
     */
    resetClean(): Promise<void>;
    /** First sign-in to an Account: every row owed, no Revisions, no pending Tombstones. */
    adoptAll(): Promise<void>;
    /** How many rows and Tombstones the server is owed, live. */
    pending(): Live<number>;
    /** Every Attachment row, bytes included, with its transfer state. */
    transfers(): Promise<AttachmentTransfer[]>;
    /** The server holds `blobId` (the row's own id or its `thumbnailId`). Owes nothing. */
    onServer(id: string, blobId: string): Promise<void>;
    /** The server refused the row's bytes for their size. Owes nothing. */
    tooLarge(id: string): Promise<void>;
    /** Downloaded bytes, which the server therefore holds. Owes nothing; a no-op if the row is gone. */
    received(id: string, bytes: { blob?: Blob; thumbnail?: Blob }): Promise<void>;
  };

  /** A consistent copy of everything a Backup carries. */
  exportAll(): Promise<Snapshot>;
  /**
   * Replaces everything a Backup carries, atomically, leaving `meta`. Every row comes in owed
   * with the Revision the store had for its id; pending Tombstones are dropped and none written,
   * so an Import never deletes anything on the server.
   */
  replaceAll(snapshot: Snapshot): Promise<void>;
  /** Empties everything, `meta` included. Tests, and erase-on-sign-out in M5. */
  clear(): Promise<void>;
}
