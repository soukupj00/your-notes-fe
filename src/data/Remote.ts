import type * as Contract from '@/contract/index.ts';

/**
 * The Remote seam (CONTEXT.md, ADR 0020) the sync engine talks to. Wire shapes come from the
 * vendored contract (`src/contract/`, `pnpm contract:pull`); this file adds only the seam's own.
 */

/** A row plus the Revision (ADR 0017) it was last in agreement with. Absent = never pushed. */
export type Revisioned<T> = T & { rev?: number };

/**
 * Records a purge so the deletion reaches offline Devices. A NoteTag's `id` is the contract's
 * `noteTagId(noteId, tagId)`; `rev` is the Revision last agreed with, absent = never pushed.
 */
export type Tombstone = Contract.Tombstone;

/**
 * Notes travel in the contract's shape: Attachment metadata rides on them (ADR 0017),
 * and the local `Note.tags` join does not (NoteTags carry it).
 */
export type PushBatch = Contract.PushBatch;

/**
 * One per pushed row, in input order: notes, tags, noteTags, tombstones. `conflict` carries the
 * server row, and a stale Tombstone answers it too, so a purge never discards a newer edit.
 * `gone` means the id is tombstoned.
 */
export type PushOutcome = Contract.PushOutcome;

/** Rows as the server holds them, in the four arrays both a push and a page carry. */
export type ServerChanges = Pick<
  Contract.ChangesPage,
  'notes' | 'tags' | 'noteTags' | 'tombstones'
>;

export type PullPage =
  | ({
      status: 'ok';
      /**
       * Opaque; the device stores it and never constructs one. `null` = caught up.
       * The HAL adapter maps an absent `_links.next` to `null`.
       */
      next: string | null;
      /**
       * This page's own address. Once `next` is null it is the cursor to keep:
       * asking it again later answers what came after it.
       */
      self: string;
      /** Where to pick up next time: `next` on a full page, else the Account's current Sequence. */
      resume: string;
      /** The Account's Sequence when the page was read; a Live Update hint past it is news. */
      seq: number;
    } & ServerChanges)
  /** 410: the cursor predates the tombstone window, or is ahead of the server after a restore. Resync from 0. */
  | { status: 'cursor-too-old' };

/** Replication only. An S3 bucket could implement this; accounts are not its concern. */
export interface Remote {
  /** Stable identity, recorded in `meta` so adopt/erase can tell a re-attach from a first attach. */
  identity(): Promise<string>;
  push(batch: PushBatch): Promise<PushOutcome[]>;
  pull(cursor: string | null): Promise<PullPage>;
  /**
   * Idempotent: bytes are write-once by id (ADR 0017). `too-large` is the one
   * refusal worth telling apart: retrying it can never succeed.
   */
  putBlob(id: string, blob: Blob): Promise<'stored' | 'too-large'>;
  getBlob(id: string): Promise<Blob | undefined>;
  /**
   * Optional Live Update: calls `onHint` with the Account's Sequence whenever
   * another Device's push lands. A Remote without it is simply polled. Returns
   * the unsubscribe.
   */
  hints?(onHint: (seq: number) => void): () => void;
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
/** A Share Link (CONTEXT.md): build the address with the contract's `shareLink(origin, token)`. */
export type Share = { id: string; noteId: string; token: string; createdAt: string };

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
  /** Shares a Note read-only; a Note already shared answers its existing Share. 404 until the Note has synced. */
  share(noteId: string): Promise<Share>;
  /** Every Share Link this Account has open, oldest first. */
  shares(): Promise<Share[]>;
  /** Ends a Share Link at once; the link then shows "Nothing is shared here". */
  revokeShare(id: string): Promise<void>;
}
