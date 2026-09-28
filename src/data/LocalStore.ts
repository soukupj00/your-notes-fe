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

/** What `notes.update` hands back: the row as it was and as it now is. */
export type NoteUpdate = { before: Note; after: Note };

/** What `notes.purge` removed alongside the note, for a lossless undo. */
export type PurgedRelations = { removedTags: NoteTag[]; removedAttachments: Attachment[] };

/** The derived data an attachment row may be rewritten with after creation. */
export type AttachmentChanges = Partial<
  Pick<Attachment, 'blob' | 'preview' | 'thumbnail' | 'duration' | 'updatedAt'>
>;

/** Everything a Backup carries. `meta` is deliberately not part of it. */
export type Snapshot = {
  notes: Note[];
  tags: Tag[];
  noteTags: NoteTag[];
  attachments: Attachment[];
};

/** The `meta` keys sync bookkeeping lives under (src/data/PLAN.md "Sync metadata"); slice 4 writes them. */
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
 * The Local Store (CONTEXT.md): the only way application code reads or writes
 * persisted data. Shaped by the domain, not by tables - see ADR 0020.
 *
 * Rules every implementation must keep, and `localStore.contract.ts` checks:
 *
 * - Every method that touches more than one row is atomic: it lands whole or
 *   not at all. There is no `transaction()` here on purpose.
 * - A `Live<T>` delivers the current value and then a new one after every
 *   write that could have changed it. Over-delivering is allowed; missing one
 *   is a bug.
 * - Search, sort and rank are not the store's job. `feed` returns the scoped
 *   rows with their tags joined on, and the caller does the rest in memory.
 * - Rows are handed back as given. The store stamps nothing: ids and timestamps
 *   are the caller's (see `lib/new-note.ts`).
 * - Sync state is the store's alone (ADR 0017). Every write that changes a Note,
 *   Tag or NoteTag marks it owed and keeps the Revision the store holds for it;
 *   an Attachment write marks its Note owed, because its metadata rides on the
 *   Note's Revision. Removing a Note, Tag or NoteTag the server has seen (it has
 *   a Revision) writes a Tombstone carrying it; one never pushed leaves nothing
 *   to tell. Putting it back takes the Tombstone back. No read returns `rev`.
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
    /** Deletes the tag and every link to it. */
    delete(id: string): Promise<void>;
    /**
     * Every note labelled `sourceId` comes out labelled `targetId`, notes that
     * carried both keep one link, and the source is deleted. Atomic. Throws if
     * the target does not exist. Merging a tag into itself changes nothing.
     */
    merge(sourceId: string, targetId: string): Promise<void>;
    /** A note's tags, live. */
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

  /**
   * Bookkeeping about the store's own rows - the Tour's Prop baselines today,
   * the sync cursor and attached Account in M5. Not Preferences: those live
   * with the Device, outside the store (CONTEXT.md, "Preference").
   */
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
     * Records the `accepted` outcomes of pushing `batch`: each row takes its new
     * Revision and stops being owed unless it changed while the push was in
     * flight; an accepted Tombstone is dropped. `conflict` and `gone` are the
     * engine's to resolve (slice 4). Throws if the counts do not pair up.
     */
    applied(batch: PushBatch, outcomes: readonly PushOutcome[]): Promise<void>;
    /**
     * Writes the server's rows, atomically, each with the server's Revision and
     * not owed (see `ApplyMode` for rows this Device still owes). A server
     * Tombstone removes the row - a Note with its links and Attachments, a Tag
     * with its links - without writing a local Tombstone, and drops a pending
     * one for the same id. Attachment metadata on a Note is not applied: its
     * rows need bytes (M5 slice 5).
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
  };

  /** A consistent copy of everything a Backup carries. */
  exportAll(): Promise<Snapshot>;
  /**
   * Replaces everything a Backup carries, atomically. `meta` is untouched.
   * Every row comes in owed, keeping the Revision of an id the store already
   * had; pending Tombstones are dropped and none are written, so an Import never
   * deletes anything on the server.
   */
  replaceAll(snapshot: Snapshot): Promise<void>;
  /** Empties everything, `meta` included. Tests, and erase-on-sign-out in M5. */
  clear(): Promise<void>;
}
