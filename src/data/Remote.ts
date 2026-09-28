import type * as Contract from '@/contract/index.ts';

/**
 * The Remote seam (CONTEXT.md "Remote"; ADR 0020). What the sync engine talks
 * to. The wire shapes come from the vendored contract (`src/contract/`, pulled
 * with `pnpm contract:pull`); this file only adds what the seam needs on top.
 * The `rev` fields on local rows land with the Dexie bump in M5 slice 3.
 */

/** A row plus the Revision (ADR 0017) it was last in agreement with. Absent = never pushed. */
export type Revisioned<T> = T & { rev?: number };

/**
 * The record that something was purged, so the deletion reaches offline devices.
 * `id` is the Note's or Tag's id, or for a NoteTag `noteTagId(noteId, tagId)` from the
 * contract, i.e. `${noteId}:${tagId}`.
 * `rev` is the Revision the Device last agreed with for what it purged; absent = never pushed.
 */
export type Tombstone = Contract.Tombstone;

/**
 * Notes travel in the contract's shape: Attachment metadata rides on them (ADR 0017),
 * and the local `Note.tags` join does not (NoteTags carry it).
 */
export type PushBatch = Contract.PushBatch;

/**
 * One per pushed row, in input order: notes, tags, noteTags, tombstones.
 * `id` for a noteTag is `noteTagId(noteId, tagId)`, the same form as its Tombstone.
 * `conflict` carries the server row; a stale note or tag Tombstone answers `conflict`
 * too, so a purge never discards a newer edit. `gone` means the id is tombstoned.
 */
export type PushOutcome = Contract.PushOutcome;

export type PullPage =
  | ({
      status: 'ok';
      /**
       * Opaque; the device stores it and never constructs one. `null` = caught up.
       * The HAL adapter maps an absent `_links.next` to `null`.
       */
      next: string | null;
    } & Pick<Contract.ChangesPage, 'notes' | 'tags' | 'noteTags' | 'tombstones'>)
  /** 410: the cursor predates the tombstone window, or is ahead of the server after a restore. Resync from 0. */
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

export type Session = {
  accountId: string;
  username: string;
  role: Contract.SessionResponse['account']['role'];
  deviceId: string;
  deviceName: string;
};
export type Device = { id: string; name: string; lastSeenAt: string; current: boolean };
/** An Account on the server, as the Owner sees it in Members. */
export type Member = {
  id: string;
  username: string;
  role: Contract.SessionResponse['account']['role'];
  createdAt: string;
};
/** A Pairing Code, shown as a Pairing Link; it works once, until `expiresAt`. */
export type PairingCode = { code: string; expiresAt: string };

/**
 * Optional. Only the Self-hosted Server implements it (ADR 0018); the Settings
 * Account section renders only when one is configured.
 * A wrong password, code or username answers `ProblemError` (`src/data/http/hal.ts`).
 */
export interface AccountService {
  /** `null` when this Device is not signed in. */
  session(): Promise<Session | null>;
  signIn(username: string, password: string, deviceName: string): Promise<Session>;
  signOut(): Promise<void>;
  devices(): Promise<Device[]>;
  revokeDevice(id: string): Promise<void>;
  /** Owner only: a code that creates a member Account (the guide's "Invite"). */
  createInvite(): Promise<PairingCode>;
  /** A code that signs another of this Account's Devices in (the guide's "Add a Device"). */
  createDeviceCode(): Promise<PairingCode>;
  /** Whether the server still has no Owner, so a Pairing Link carries the printed setup code. */
  setupNeeded(): Promise<boolean>;
  /** Spends the printed setup code: this Device becomes the Owner's first. */
  setup(code: string, username: string, password: string, deviceName: string): Promise<Session>;
  /** Spends a device code: signs this Device in to the Account that minted it. */
  pair(code: string, deviceName: string): Promise<Session>;
  /** Spends an Invite: a new member Account, with this Device signed in to it. */
  join(code: string, username: string, password: string, deviceName: string): Promise<Session>;
  /** Owner only: every Account on the server, the Owner's included, oldest first. */
  accounts(): Promise<Member[]>;
  /** Owner only. The Account's Devices stay signed in. */
  resetPassword(accountId: string, password: string): Promise<void>;
}
