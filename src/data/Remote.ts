import type { Note, NoteTag, Tag } from '@/models.ts';

/**
 * The Remote seam (CONTEXT.md "Remote"; ADR 0020). What the sync engine talks
 * to. These are declarations so the engine is designed against them; the
 * shapes are finalised in M5 slice 3 against the vendored contract, and the
 * `rev` fields land with the Dexie bump in the same slice.
 */

/** A row plus the Revision (ADR 0017) it was last in agreement with. Absent = never pushed. */
export type Revisioned<T> = T & { rev?: number };

/** The record that something was purged, so the deletion reaches offline devices. */
export type Tombstone = { id: string; kind: 'note' | 'tag' | 'noteTag'; deletedAt: string };

export type PushBatch = {
  notes: Revisioned<Note>[];
  tags: Revisioned<Tag>[];
  noteTags: Revisioned<NoteTag>[];
  tombstones: Tombstone[];
};

export type PushOutcome =
  | { kind: 'note' | 'tag' | 'noteTag'; id: string; status: 'accepted'; rev: number }
  | { kind: 'note'; id: string; status: 'conflict'; server: Revisioned<Note> }
  | { kind: 'tag'; id: string; status: 'conflict'; server: Revisioned<Tag> }
  | { kind: 'note' | 'tag' | 'noteTag'; id: string; status: 'gone' };

export type PullPage =
  | {
      status: 'ok';
      notes: Revisioned<Note>[];
      tags: Revisioned<Tag>[];
      noteTags: Revisioned<NoteTag>[];
      tombstones: Tombstone[];
      /** Opaque; the device stores it and never constructs one. `null` = caught up. */
      next: string | null;
    }
  | { status: 'cursor-too-old' };

/** Replication only. An S3 bucket could implement this; accounts are not its concern. */
export interface Remote {
  /** Stable identity, recorded in `meta` so adopt/erase can tell a re-attach from a first attach. */
  identity(): Promise<string>;
  push(batch: PushBatch): Promise<PushOutcome[]>;
  pull(cursor: string | null): Promise<PullPage>;
  /** Idempotent: bytes are write-once by id (ADR 0017). */
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
}

export type Session = { accountId: string; deviceId: string };
export type Device = { id: string; name: string; lastSeenAt: string; current: boolean };

/**
 * Optional. Only the Self-hosted Server implements it (ADR 0018); the Settings
 * Account section renders only when one is configured.
 */
export interface AccountService {
  session(): Promise<Session | null>;
  signIn(username: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  devices(): Promise<Device[]>;
  revokeDevice(id: string): Promise<void>;
  createInvite(): Promise<{ code: string }>;
}
