# M5 Slice 1 - The Local Store Seam - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every read and write of persisted data goes through one `LocalStore` interface, with a Dexie implementation (default) and an in-memory one, both proven by one contract test suite; Preferences move to `localStorage`; nothing outside `src/data/dexie/` may import Dexie.

**Architecture:** A domain-shaped interface (`src/data/LocalStore.ts`) whose live reads return a minimal observable `Live<T>` and whose multi-row operations are single atomic methods. It is provided by React context (`LocalStoreProvider`), composed once in `App.tsx`; non-React modules take the store as an argument. Dexie moves into `src/data/dexie/`, fenced by Biome's `noRestrictedImports`. The hooks in `src/hooks/data` keep their public shape - only their bodies change, so components are untouched.

**Tech Stack:** TypeScript, React 19, Dexie 4 (`liveQuery`), Vitest + `fake-indexeddb`, Biome 2.

**Spec:** [ADR 0020](../../adr/0020-the-local-store-seam.md); glossary terms Local Store, Remote, Preference in [`CONTEXT.md`](../../../CONTEXT.md). Sync context in [ADR 0017](../../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md) and [`docs/architecture/04-sync.md`](../../architecture/04-sync.md).

## Global Constraints

- Package manager is `pnpm`; never npm or yarn.
- Never use the em dash; plain `-` only, in code comments and docs alike.
- Never add a `Co-Authored-By` trailer to commits.
- `pnpm check` (Biome) must pass on every commit; the pre-commit hook runs it on staged files.
- Keep files under 500 lines.
- IDs are `uuid` v4; timestamps are ISO strings via `new Date().toISOString()`.
- The public shape of every hook in `src/hooks/data` is unchanged. Components are not edited in this slice except to swap an import.
- No Dexie version bump. The `settings` table stays as it is and is exposed as `meta`.
- No user-facing UI for choosing a store. Ever.
- Behaviour to preserve, verbatim, because tests lock it: `useAttachmentsByNote` Map identity per note (`useNoteAttachments.test.ts`), held rank (`useNoteFeed.test.ts`), pinned-first, `createTag` case-insensitive idempotency, `addTagToNote` idempotency, `purgeNote` returning removed relations.

## File structure

```
src/data/
  live.ts                 Live<T> + Unsubscribe                       (Task 1)
  useLive.ts              useLive(make, deps) - the one React adapter  (Task 1)
  LocalStore.ts           the interface + its value types              (Task 2)
  Remote.ts               Remote + AccountService, types only          (Task 2)
  LocalStoreProvider.tsx  context, useLocalStore()                     (Task 5)
  localStore.contract.ts  describeLocalStoreContract(makeStore)        (Task 3)
  dexie/
    db.ts                 moved from src/db/db.ts, unchanged           (Task 3)
    DexieLocalStore.ts    createDexieLocalStore()                      (Task 3)
    DexieLocalStore.test.ts   runs the contract on fake-indexeddb      (Task 3)
    lifecycle.migration.test.ts, attachments.roundtrip.test.ts  moved  (Task 3)
    legacyPreferences.ts  one-shot settings -> localStorage/meta       (Task 8)
  memory/
    MemoryLocalStore.ts   createMemoryLocalStore()                     (Task 4)
    MemoryLocalStore.test.ts  runs the contract                        (Task 4)
  CLAUDE.md, PLAN.md      moved from src/db and rewritten              (Task 10)
src/lib/new-note.ts       newNote(partial): Note - shared by createNote and the Tour (Task 2)
src/test/store.tsx        testStore, clearStore(), renderHookWithStore  (Task 5)
```

`src/db/` is deleted in Task 9; until then `src/db/db.ts` re-exports from the new location so the tree stays green between tasks.

---

### Task 1: `Live<T>` and `useLive`

**Files:**
- Create: `src/data/live.ts`
- Create: `src/data/useLive.ts`
- Test: `src/data/useLive.test.tsx`

**Interfaces:**
- Produces: `Live<T> = { subscribe(next: (value: T) => void): Unsubscribe }`, `useLive<T>(make: () => Live<T>, deps): T | undefined`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/data/useLive.test.tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Live } from './live.ts';
import { useLive } from './useLive.ts';

/** A hand-driven Live: the test decides when values arrive. */
function manual<T>() {
  const listeners = new Set<(value: T) => void>();
  const live: Live<T> = {
    subscribe(next) {
      listeners.add(next);
      return () => listeners.delete(next);
    },
  };
  return { live, emit: (value: T) => listeners.forEach((l) => l(value)), size: () => listeners.size };
}

describe('useLive', () => {
  it('is undefined until the first value arrives, then follows every emission', () => {
    const source = manual<number>();
    const { result } = renderHook(() => useLive(() => source.live, []));
    expect(result.current).toBeUndefined();
    act(() => source.emit(1));
    expect(result.current).toBe(1);
    act(() => source.emit(2));
    expect(result.current).toBe(2);
  });

  it('unsubscribes on unmount', () => {
    const source = manual<number>();
    const { unmount } = renderHook(() => useLive(() => source.live, []));
    expect(source.size()).toBe(1);
    unmount();
    expect(source.size()).toBe(0);
  });

  it('re-subscribes when a dep changes and keeps the last value meanwhile', () => {
    const a = manual<string>();
    const b = manual<string>();
    const { result, rerender } = renderHook(({ which }) => useLive(() => (which === 'a' ? a.live : b.live), [which]), {
      initialProps: { which: 'a' },
    });
    act(() => a.emit('from a'));
    rerender({ which: 'b' });
    expect(a.size()).toBe(0);
    expect(b.size()).toBe(1);
    // The previous value is kept rather than flashing to undefined: the feed
    // would otherwise show skeletons on every route change.
    expect(result.current).toBe('from a');
    act(() => b.emit('from b'));
    expect(result.current).toBe('from b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/useLive.test.tsx`
Expected: FAIL - cannot resolve `./live.ts` / `./useLive.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/live.ts
export type Unsubscribe = () => void;

/**
 * A value the Local Store keeps current. `subscribe` delivers the present value
 * (asynchronously) and every later value the store's writes produce, until the
 * returned function is called.
 *
 * Deliberately the smallest observable that works: one method, no operators,
 * no error channel. A read that throws is a bug in the store, not an event.
 */
export interface Live<T> {
  subscribe(next: (value: T) => void): Unsubscribe;
}
```

```ts
// src/data/useLive.ts
import { type DependencyList, useEffect, useState } from 'react';
import type { Live } from './live.ts';

/**
 * The one React adapter for a `Live<T>`. Returns `undefined` until the first
 * value lands, which callers read as "loading" - the same contract
 * `useLiveQuery` had, so hooks keep their public shape.
 *
 * `deps` is the caller's list, exactly as with `useLiveQuery`: the Live is
 * rebuilt (and re-subscribed) when it changes. The last value is kept across
 * that swap on purpose - a route change must not flash skeletons.
 */
export function useLive<T>(make: () => Live<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's, by contract
  useEffect(() => make().subscribe(setValue), deps);
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/useLive.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/live.ts src/data/useLive.ts src/data/useLive.test.tsx
git commit -m "[ADD] Live<T> and useLive, the seam's reactive read contract (ADR 0020)"
```

---

### Task 2: The `LocalStore` interface, `newNote`, and the Remote type declarations

**Files:**
- Create: `src/data/LocalStore.ts`
- Create: `src/data/Remote.ts`
- Create: `src/lib/new-note.ts`
- Test: `src/lib/new-note.test.ts`

**Interfaces:**
- Produces: everything below. Later tasks use these names verbatim.

- [ ] **Step 1: Write the failing test for `newNote`**

```ts
// src/lib/new-note.test.ts
import { describe, expect, it } from 'vitest';
import { newNote } from './new-note.ts';

describe('newNote', () => {
  it('fills every default and stamps both timestamps equal', () => {
    const note = newNote({});
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(note).toMatchObject({ header: '', description: '', body: '', state: 'active' });
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it('keeps a supplied id, because the editor puts it in the URL before the row exists', () => {
    expect(newNote({ id: 'given' }).id).toBe('given');
  });

  it('carries trashedAt through so a note seeded into the trash is not immortal', () => {
    expect(newNote({ state: 'trashed', trashedAt: '2026-01-01T00:00:00.000Z' }).trashedAt).toBe(
      '2026-01-01T00:00:00.000Z'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/new-note.test.ts`
Expected: FAIL - cannot resolve `./new-note.ts`.

- [ ] **Step 3: Write `newNote`** (lifted verbatim from `useNoteActions.createNote`, minus the write)

```ts
// src/lib/new-note.ts
import { v4 as uuid } from 'uuid';
import type { Note } from '@/models.ts';

/**
 * Builds a Note row from a partial, without persisting it. Shared by
 * `useNoteActions.createNote` and the Tour's Prop seed, so there is one place
 * that knows the defaults.
 *
 * An id may be supplied rather than minted: a note's id goes into the URL the
 * moment its editor opens, before there is anything worth persisting
 * (ADR 0014). `trashedAt` is carried through so a note seeded straight into the
 * trash still has the timestamp the purge sweep keys off.
 */
export function newNote(data: Partial<Note>): Note {
  const now = new Date().toISOString();
  return {
    id: data.id ?? uuid(),
    header: data.header ?? '',
    description: data.description ?? '',
    body: data.body ?? '',
    state: data.state ?? 'active',
    pinnedAt: data.pinnedAt,
    color: data.color,
    trashedAt: data.trashedAt,
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/new-note.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the interface**

```ts
// src/data/LocalStore.ts
import type { Attachment, Note, NoteState, NoteTag, Tag } from '@/models.ts';
import type { Live } from './live.ts';

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
     * the target does not exist.
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

  /** A consistent copy of everything a Backup carries. */
  exportAll(): Promise<Snapshot>;
  /** Replaces everything a Backup carries, atomically. `meta` is untouched. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  /** Empties everything, `meta` included. Tests, and erase-on-sign-out in M5. */
  clear(): Promise<void>;
}
```

- [ ] **Step 6: Declare the Remote seam** (types only; implementations are M5 slices 3-5)

```ts
// src/data/Remote.ts
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
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm tsc -b --noEmit && pnpm check`
Expected: clean.

```bash
git add src/data/LocalStore.ts src/data/Remote.ts src/lib/new-note.ts src/lib/new-note.test.ts
git commit -m "[ADD] LocalStore interface, Remote declarations, newNote factory (ADR 0020)"
```

---

### Task 3: The contract suite and the Dexie implementation

**Files:**
- Create: `src/data/localStore.contract.ts`
- Move: `src/db/db.ts` -> `src/data/dexie/db.ts` (`git mv`, content unchanged)
- Move: `src/db/lifecycle.migration.test.ts`, `src/db/attachments.roundtrip.test.ts` -> `src/data/dexie/` (fix their relative imports of `./db.ts`)
- Create: `src/db/db.ts` as a one-line re-export `export { db, NotesDB } from '@/data/dexie/db.ts';` so the 30 files still importing `@/db/db.ts` keep working until Task 9
- Create: `src/data/dexie/DexieLocalStore.ts`
- Test: `src/data/dexie/DexieLocalStore.test.ts`

**Interfaces:**
- Consumes: `LocalStore`, `Live`.
- Produces: `describeLocalStoreContract(makeStore: () => Promise<LocalStore>)`, `createDexieLocalStore(db?: NotesDB): LocalStore`.

- [ ] **Step 1: Write the contract** - this file *is* the specification; every implementation runs it

```ts
// src/data/localStore.contract.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';
import type { Live } from './live.ts';
import type { LocalStore } from './LocalStore.ts';

const T0 = '2026-01-01T00:00:00.000Z';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    header: 'h',
    description: '',
    body: '',
    state: 'active',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function tag(overrides: Partial<Tag> = {}): Tag {
  return { id: crypto.randomUUID(), name: 'Work', createdAt: T0, updatedAt: T0, ...overrides };
}

function link(noteId: string, tagId: string): NoteTag {
  return { noteId, tagId, createdAt: T0, updatedAt: T0 };
}

function attachment(noteId: string, overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: crypto.randomUUID(),
    noteId,
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x']),
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** Collects every value a Live delivers, so a test can assert on the sequence. */
function collect<T>(live: Live<T>) {
  const values: T[] = [];
  const unsubscribe = live.subscribe((value) => values.push(value));
  return { values, unsubscribe, latest: () => values[values.length - 1] };
}

/** Polls until `predicate` holds; a Live delivers asynchronously in every implementation. */
async function until(predicate: () => boolean, label = 'condition') {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

/**
 * The behaviour every Local Store must have. Run it from one test file per
 * implementation: `describeLocalStoreContract(() => makeFreshStore())`.
 * `makeStore` must return an *empty* store each time.
 */
export function describeLocalStoreContract(makeStore: () => Promise<LocalStore>) {
  describe('LocalStore contract', () => {
    let store: LocalStore;
    beforeEach(async () => {
      store = await makeStore();
    });
    afterEach(async () => {
      await store.clear();
    });

    describe('notes', () => {
      it('add / get / list / put', async () => {
        const n = note();
        await store.notes.add(n);
        expect(await store.notes.get(n.id)).toEqual(n);
        await store.notes.put({ ...n, header: 'changed' });
        expect((await store.notes.get(n.id))?.header).toBe('changed');
        expect(await store.notes.list()).toHaveLength(1);
        expect(await store.notes.get('missing')).toBeUndefined();
      });

      it('listByState and listTrashedBefore use the fields, not the caller', async () => {
        const active = note();
        const old = note({ state: 'trashed', trashedAt: '2025-01-01T00:00:00.000Z' });
        const recent = note({ state: 'trashed', trashedAt: '2026-06-01T00:00:00.000Z' });
        for (const n of [active, old, recent]) await store.notes.add(n);
        expect(ids(await store.notes.listByState('trashed'))).toEqual(ids([old, recent]));
        expect(ids(await store.notes.listTrashedBefore('2026-01-01T00:00:00.000Z'))).toEqual([old.id]);
      });

      it('update is a read-modify-write that reports before and after, and null when gone', async () => {
        const n = note({ header: 'a' });
        await store.notes.add(n);
        const result = await store.notes.update(n.id, (current) => ({ header: `${current.header}b` }));
        expect(result?.before.header).toBe('a');
        expect(result?.after.header).toBe('ab');
        expect((await store.notes.get(n.id))?.header).toBe('ab');
        expect(await store.notes.update('missing', () => ({}))).toBeNull();
      });

      it('update can clear an optional field', async () => {
        const n = note({ pinnedAt: T0 });
        await store.notes.add(n);
        await store.notes.update(n.id, () => ({ pinnedAt: undefined }));
        expect((await store.notes.get(n.id))?.pinnedAt).toBeUndefined();
      });

      it('purge removes links and attachments and returns them; restore puts everything back', async () => {
        const n = note();
        const t = tag();
        const a = attachment(n.id);
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.attachments.add(a);

        const removed = await store.notes.purge(n.id);
        expect(removed.removedTags.map((l) => l.tagId)).toEqual([t.id]);
        expect(ids(removed.removedAttachments)).toEqual([a.id]);
        expect(await store.notes.get(n.id)).toBeUndefined();
        expect(await store.attachments.get(a.id)).toBeUndefined();
        expect(await store.tags.listLinks()).toEqual([]);
        expect(await store.tags.get(t.id)).toEqual(t); // the tag itself survives

        await store.notes.restore(n, removed);
        expect(await store.notes.get(n.id)).toEqual(n);
        expect(await store.tags.listLinks()).toHaveLength(1);
        expect(await store.attachments.get(a.id)).toBeDefined();
      });

      it('feed is live, scoped by state and tag, and joins tags on', async () => {
        const t = tag({ name: 'Work' });
        const inTag = note({ header: 'in' });
        const outOfTag = note({ header: 'out' });
        const archived = note({ state: 'archived' });
        await store.tags.add(t);
        for (const n of [inTag, outOfTag, archived]) await store.notes.add(n);
        await store.tags.link(link(inTag.id, t.id));

        const active = collect(store.notes.feed({ state: 'active' }));
        await until(() => active.values.length >= 1, 'first feed value');
        expect(ids(active.latest())).toEqual(ids([inTag, outOfTag]));
        expect(active.latest().find((n) => n.id === inTag.id)?.tags).toEqual([t]);
        expect(active.latest().find((n) => n.id === outOfTag.id)?.tags).toEqual([]);

        const scoped = collect(store.notes.feed({ state: 'active', tagId: t.id }));
        await until(() => scoped.values.length >= 1, 'scoped feed value');
        expect(ids(scoped.latest())).toEqual([inTag.id]);

        const added = note({ header: 'new' });
        await store.notes.add(added);
        await until(() => active.latest().some((n) => n.id === added.id), 'feed to see the add');

        await store.tags.link(link(added.id, t.id));
        await until(() => scoped.latest().some((n) => n.id === added.id), 'scoped feed to see the link');

        active.unsubscribe();
        scoped.unsubscribe();
      });
    });

    describe('tags', () => {
      it('findByName ignores case and surrounding whitespace', async () => {
        const t = tag({ name: 'Work' });
        await store.tags.add(t);
        expect(await store.tags.findByName('work')).toEqual(t);
        expect(await store.tags.findByName('  WORK ')).toEqual(t);
        expect(await store.tags.findByName('wor')).toBeUndefined();
      });

      it('link is idempotent and unlink removes exactly one link', async () => {
        const n = note();
        const t1 = tag({ name: 'a' });
        const t2 = tag({ name: 'b' });
        await store.notes.add(n);
        await store.tags.add(t1);
        await store.tags.add(t2);
        const first = link(n.id, t1.id);
        await store.tags.link(first);
        await store.tags.link({ ...first, createdAt: 'later' });
        await store.tags.link(link(n.id, t2.id));
        const links = await store.tags.listLinks();
        expect(links).toHaveLength(2);
        expect(links.find((l) => l.tagId === t1.id)?.createdAt).toBe(T0); // the first write won
        await store.tags.unlink(n.id, t1.id);
        expect((await store.tags.listLinks()).map((l) => l.tagId)).toEqual([t2.id]);
      });

      it('delete cascades to links', async () => {
        const n = note();
        const t = tag();
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.tags.delete(t.id);
        expect(await store.tags.get(t.id)).toBeUndefined();
        expect(await store.tags.listLinks()).toEqual([]);
      });

      it('merge relabels, dedupes notes carrying both, deletes the source, and refuses a missing target', async () => {
        const both = note();
        const onlySource = note();
        const source = tag({ name: 'src' });
        const target = tag({ name: 'dst' });
        for (const n of [both, onlySource]) await store.notes.add(n);
        await store.tags.add(source);
        await store.tags.add(target);
        await store.tags.link(link(both.id, source.id));
        await store.tags.link(link(both.id, target.id));
        await store.tags.link(link(onlySource.id, source.id));

        await store.tags.merge(source.id, target.id);

        const links = await store.tags.listLinks();
        expect(links.every((l) => l.tagId === target.id)).toBe(true);
        expect(links.map((l) => l.noteId).sort()).toEqual([both.id, onlySource.id].sort());
        expect(await store.tags.get(source.id)).toBeUndefined();
        await expect(store.tags.merge(target.id, 'missing')).rejects.toThrow();
      });

      it('all, watch and forNote are live', async () => {
        const n = note();
        await store.notes.add(n);
        const all = collect(store.tags.all());
        const one = tag({ name: 'x' });
        const watched = collect(store.tags.watch(one.id));
        const forNote = collect(store.tags.forNote(n.id));
        await until(() => all.values.length >= 1 && watched.values.length >= 1 && forNote.values.length >= 1);
        expect(all.latest()).toEqual([]);
        expect(watched.latest()).toBeUndefined();
        expect(forNote.latest()).toEqual([]);

        await store.tags.add(one);
        await until(() => all.latest().length === 1, 'all to see the add');
        await until(() => watched.latest()?.id === one.id, 'watch to see the add');

        await store.tags.link(link(n.id, one.id));
        await until(() => forNote.latest().length === 1, 'forNote to see the link');

        await store.tags.put({ ...one, name: 'renamed' });
        await until(() => watched.latest()?.name === 'renamed', 'watch to see the rename');
        await until(() => forNote.latest()[0]?.name === 'renamed', 'forNote to see the rename');

        all.unsubscribe();
        watched.unsubscribe();
        forNote.unsubscribe();
      });
    });

    describe('attachments', () => {
      it('add / get / update / delete', async () => {
        const n = note();
        const a = attachment(n.id);
        await store.notes.add(n);
        await store.attachments.add(a);
        expect((await store.attachments.get(a.id))?.id).toBe(a.id);
        await store.attachments.update(a.id, { duration: 12, updatedAt: '2026-02-02T00:00:00.000Z' });
        const row = await store.attachments.get(a.id);
        expect(row?.duration).toBe(12);
        expect(row?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
        await store.attachments.delete(a.id);
        expect(await store.attachments.get(a.id)).toBeUndefined();
      });

      it('forNote, forNotes and watch are live', async () => {
        const n1 = note();
        const n2 = note();
        await store.notes.add(n1);
        await store.notes.add(n2);
        const a1 = attachment(n1.id);
        const forNote = collect(store.attachments.forNote(n1.id));
        const forNotes = collect(store.attachments.forNotes([n1.id, n2.id]));
        const watched = collect(store.attachments.watch(a1.id));
        await until(() => forNote.values.length >= 1 && forNotes.values.length >= 1 && watched.values.length >= 1);

        await store.attachments.add(a1);
        await until(() => forNote.latest().length === 1, 'forNote');
        await until(() => watched.latest()?.id === a1.id, 'watch');
        await store.attachments.add(attachment(n2.id));
        await until(() => forNotes.latest().length === 2, 'forNotes');
        expect(forNote.latest()).toHaveLength(1);

        forNote.unsubscribe();
        forNotes.unsubscribe();
        watched.unsubscribe();
      });

      it('forNotes with no ids delivers an empty list and never throws', async () => {
        const empty = collect(store.attachments.forNotes([]));
        await until(() => empty.values.length >= 1);
        expect(empty.latest()).toEqual([]);
        empty.unsubscribe();
      });

      it('sweepNote keeps only the listed ids of that note', async () => {
        const n = note();
        const other = note();
        await store.notes.add(n);
        await store.notes.add(other);
        const keep = attachment(n.id);
        const drop = attachment(n.id);
        const elsewhere = attachment(other.id);
        for (const a of [keep, drop, elsewhere]) await store.attachments.add(a);
        expect(await store.attachments.sweepNote(n.id, [keep.id])).toBe(1);
        expect(ids(await store.attachments.list())).toEqual(ids([keep, elsewhere]));
      });

      it('sweepAll drops rows with no owner and rows the owner no longer references', async () => {
        const owner = note({ body: 'ref:KEEP' });
        await store.notes.add(owner);
        const referenced = attachment(owner.id, { id: 'KEEP' });
        const unreferenced = attachment(owner.id);
        const orphan = attachment('no-such-note');
        for (const a of [referenced, unreferenced, orphan]) await store.attachments.add(a);
        const count = await store.attachments.sweepAll((n) => (n.body?.includes('ref:KEEP') ? ['KEEP'] : []));
        expect(count).toBe(2);
        expect(ids(await store.attachments.list())).toEqual(['KEEP']);
      });
    });

    describe('meta', () => {
      it('get / set / delete round-trip any JSON value', async () => {
        expect(await store.meta.get('k')).toBeUndefined();
        await store.meta.set('k', { a: [1, 2] });
        expect(await store.meta.get('k')).toEqual({ a: [1, 2] });
        await store.meta.set('k', 'replaced');
        expect(await store.meta.get('k')).toBe('replaced');
        await store.meta.delete('k');
        expect(await store.meta.get('k')).toBeUndefined();
      });
    });

    describe('whole store', () => {
      it('exportAll / replaceAll round-trip the four data stores and leave meta alone', async () => {
        const n = note();
        const t = tag();
        await store.notes.add(n);
        await store.tags.add(t);
        await store.tags.link(link(n.id, t.id));
        await store.attachments.add(attachment(n.id));
        await store.meta.set('cursor', 'abc');

        const snapshot = await store.exportAll();
        expect(snapshot.notes).toHaveLength(1);
        expect(snapshot.tags).toHaveLength(1);
        expect(snapshot.noteTags).toHaveLength(1);
        expect(snapshot.attachments).toHaveLength(1);

        const replacement = note({ header: 'only me' });
        await store.replaceAll({ notes: [replacement], tags: [], noteTags: [], attachments: [] });
        expect(ids(await store.notes.list())).toEqual([replacement.id]);
        expect(await store.tags.list()).toEqual([]);
        expect(await store.tags.listLinks()).toEqual([]);
        expect(await store.attachments.list()).toEqual([]);
        expect(await store.meta.get('cursor')).toBe('abc');

        await store.replaceAll(snapshot);
        expect(ids(await store.notes.list())).toEqual([n.id]);
      });

      it('clear empties everything, meta included', async () => {
        await store.notes.add(note());
        await store.meta.set('k', 1);
        await store.clear();
        expect(await store.notes.list()).toEqual([]);
        expect(await store.meta.get('k')).toBeUndefined();
      });
    });
  });
}
```

- [ ] **Step 2: Move Dexie and write the Dexie test file**

```bash
mkdir -p src/data/dexie
git mv src/db/db.ts src/data/dexie/db.ts
git mv src/db/lifecycle.migration.test.ts src/data/dexie/lifecycle.migration.test.ts
git mv src/db/attachments.roundtrip.test.ts src/data/dexie/attachments.roundtrip.test.ts
printf "export { db, NotesDB } from '@/data/dexie/db.ts';\n" > src/db/db.ts
```

Open the two moved tests and change any `from './db.ts'` / `from '@/db/db.ts'` to `from './db.ts'` (they now sit beside it).

```ts
// src/data/dexie/DexieLocalStore.test.ts
import { describeLocalStoreContract } from '../localStore.contract.ts';
import { createDexieLocalStore } from './DexieLocalStore.ts';
import { NotesDB } from './db.ts';

// A fresh, uniquely named database per test: `fake-indexeddb/auto` is loaded
// by src/test/setup.ts, and a shared name would leak rows between tests.
describeLocalStoreContract(async () => createDexieLocalStore(new NotesDB(`contract-${crypto.randomUUID()}`)));
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/data/dexie/DexieLocalStore.test.ts`
Expected: FAIL - cannot resolve `./DexieLocalStore.ts`.

- [ ] **Step 4: Write the Dexie implementation**

```ts
// src/data/dexie/DexieLocalStore.ts
import { liveQuery } from 'dexie';
import type { Attachment, Note, NoteState, NoteTag, Tag } from '@/models.ts';
import type { Live } from '../live.ts';
import type { AttachmentChanges, LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';
import { db as defaultDb, type NotesDB } from './db.ts';

/** Dexie's `liveQuery` already is the contract; this only narrows its Observable to `Live<T>`. */
function live<T>(querier: () => T | Promise<T>): Live<T> {
  return {
    subscribe(next) {
      const subscription = liveQuery(querier).subscribe(next);
      return () => subscription.unsubscribe();
    },
  };
}

/**
 * The default Local Store: IndexedDB through Dexie (ADR 0001, ADR 0020).
 *
 * `db` is a parameter only so the contract test can spin up a throwaway
 * database per test; the app passes nothing and gets the singleton.
 */
export function createDexieLocalStore(db: NotesDB = defaultDb): LocalStore {
  /** The feed's read, shared by `feed()` so the join lives in one place. */
  async function readFeed(scope: NoteFeedScope): Promise<Note[]> {
    let candidates = await db.notes.where('state').equals(scope.state).toArray();
    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((l) => l.noteId));
      candidates = candidates.filter((n) => inTag.has(n.id));
    }
    // Both tables are read whole on purpose: on the active feed the candidates
    // are most of the library, so per-note index seeks would cost more than one
    // sequential read of a two-column join table.
    const [allTags, links] = await Promise.all([db.tags.toArray(), db.noteTags.toArray()]);
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    const tagsByNote = new Map<string, Tag[]>();
    for (const l of links) {
      const t = tagById.get(l.tagId);
      if (!t) continue;
      const list = tagsByNote.get(l.noteId);
      if (list) list.push(t);
      else tagsByNote.set(l.noteId, [t]);
    }
    return candidates.map((n) => ({ ...n, tags: tagsByNote.get(n.id) ?? [] }));
  }

  async function tagsForNote(noteId: string): Promise<Tag[]> {
    const links = await db.noteTags.where('noteId').equals(noteId).toArray();
    if (links.length === 0) return [];
    const rows = await db.tags.bulkGet(links.map((l) => l.tagId));
    return rows.filter((t): t is Tag => Boolean(t));
  }

  return {
    notes: {
      get: (id) => db.notes.get(id),
      list: () => db.notes.toArray(),
      listByState: (state: NoteState) => db.notes.where('state').equals(state).toArray(),
      // `trashedAt` is indexed, so this is a range scan; it runs on every app start.
      listTrashedBefore: (cutoff) => db.notes.where('trashedAt').below(cutoff).toArray(),
      feed: (scope) => live(() => readFeed(scope)),
      add: async (note) => {
        await db.notes.add(note);
      },
      put: async (note) => {
        await db.notes.put(note);
      },
      update: (id, change) =>
        db.transaction('rw', db.notes, async () => {
          const before = await db.notes.get(id);
          if (!before) return null;
          const after = { ...before, ...change(before) };
          await db.notes.put(after);
          return { before, after };
        }),
      purge: (id) =>
        db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
          const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
          const removedAttachments = await db.attachments.where('noteId').equals(id).toArray();
          await db.notes.delete(id);
          await db.noteTags.where('noteId').equals(id).delete();
          await db.attachments.where('noteId').equals(id).delete();
          return { removedTags, removedAttachments };
        }),
      restore: (note, removed = {}) =>
        db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
          await db.notes.put(note);
          if (removed.removedTags?.length) await db.noteTags.bulkPut(removed.removedTags);
          if (removed.removedAttachments?.length) await db.attachments.bulkPut(removed.removedAttachments);
        }),
    },

    tags: {
      get: (id) => db.tags.get(id),
      watch: (id) => live(() => db.tags.get(id)),
      list: () => db.tags.toArray(),
      all: () => live(() => db.tags.toArray()),
      // Through the `name` index rather than a scan: this runs per keystroke-driven create.
      findByName: (name) => db.tags.where('name').equalsIgnoreCase(name.trim()).first(),
      add: async (tag) => {
        await db.tags.add(tag);
      },
      put: async (tag) => {
        await db.tags.put(tag);
      },
      delete: (id) =>
        db.transaction('rw', db.tags, db.noteTags, async () => {
          await db.tags.delete(id);
          await db.noteTags.where('tagId').equals(id).delete();
        }),
      merge: (sourceId, targetId) =>
        db.transaction('rw', db.tags, db.noteTags, async () => {
          const target = await db.tags.get(targetId);
          if (!target) throw new Error(`Cannot merge into unknown tag ${targetId}`);
          const sourceLinks = await db.noteTags.where('tagId').equals(sourceId).toArray();
          const targetLinks = await db.noteTags.where('tagId').equals(targetId).toArray();
          const alreadyLinked = new Set(targetLinks.map((l) => l.noteId));
          const now = new Date().toISOString();
          await db.noteTags.bulkAdd(
            sourceLinks
              .filter((l) => !alreadyLinked.has(l.noteId))
              .map((l) => ({ noteId: l.noteId, tagId: targetId, createdAt: l.createdAt, updatedAt: now }))
          );
          await db.noteTags.where('tagId').equals(sourceId).delete();
          await db.tags.delete(sourceId);
        }),
      forNote: (noteId) => live(() => tagsForNote(noteId)),
      link: (link: NoteTag) =>
        db.transaction('rw', db.noteTags, async () => {
          const exists = await db.noteTags.get([link.noteId, link.tagId]);
          if (!exists) await db.noteTags.add(link);
        }),
      unlink: async (noteId, tagId) => {
        await db.noteTags.delete([noteId, tagId]);
      },
      listLinks: () => db.noteTags.toArray(),
    },

    attachments: {
      get: (id) => db.attachments.get(id),
      watch: (id) => live(() => db.attachments.get(id)),
      list: () => db.attachments.toArray(),
      forNote: (noteId) => live(() => db.attachments.where('noteId').equals(noteId).toArray()),
      forNotes: (noteIds) =>
        live(() =>
          noteIds.length === 0
            ? Promise.resolve([] as Attachment[])
            : db.attachments.where('noteId').anyOf([...noteIds]).toArray()
        ),
      add: async (attachment) => {
        await db.attachments.add(attachment);
      },
      update: async (id, changes: AttachmentChanges) => {
        await db.attachments.update(id, changes);
      },
      delete: async (id) => {
        await db.attachments.delete(id);
      },
      sweepNote: (noteId, keep) =>
        db.transaction('rw', db.attachments, async () => {
          const kept = new Set(keep);
          const rows = await db.attachments.where('noteId').equals(noteId).toArray();
          const orphans = rows.filter((r) => !kept.has(r.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
          return orphans.length;
        }),
      sweepAll: (referencedBy) =>
        db.transaction('rw', db.notes, db.attachments, async () => {
          const [notes, all] = await Promise.all([db.notes.toArray(), db.attachments.toArray()]);
          const referenced = new Map(notes.map((n) => [n.id, new Set(referencedBy(n))]));
          // No entry at all means the owner is gone - an orphan for the same reason.
          const orphans = all.filter((row) => !referenced.get(row.noteId)?.has(row.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
          return orphans.length;
        }),
    },

    // The Dexie table is still called `settings` (no schema bump, ADR 0020);
    // `meta` is what it holds now that Preferences live in localStorage.
    meta: {
      get: async <T,>(key: string) => (await db.settings.get(key))?.value as T | undefined,
      set: async (key, value) => {
        await db.settings.put({ key, value });
      },
      delete: async (key) => {
        await db.settings.delete(key);
      },
    },

    exportAll: () =>
      db.transaction('r', db.notes, db.tags, db.noteTags, db.attachments, async () => {
        const [notes, tags, noteTags, attachments] = await Promise.all([
          db.notes.toArray(),
          db.tags.toArray(),
          db.noteTags.toArray(),
          db.attachments.toArray(),
        ]);
        return { notes, tags, noteTags, attachments } satisfies Snapshot;
      }),
    replaceAll: (snapshot) =>
      db.transaction('rw', db.notes, db.tags, db.noteTags, db.attachments, async () => {
        await Promise.all([db.notes.clear(), db.tags.clear(), db.noteTags.clear(), db.attachments.clear()]);
        await db.notes.bulkPut(snapshot.notes);
        await db.tags.bulkPut(snapshot.tags);
        await db.noteTags.bulkPut(snapshot.noteTags);
        await db.attachments.bulkPut(snapshot.attachments);
      }),
    clear: () =>
      db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((table) => table.clear()));
      }),
  };
}
```

Note the `<T,>` in `meta.get`: this is a `.ts` file, so a plain `<T>` is fine there; drop the comma if Biome complains.

- [ ] **Step 5: Run the contract and the moved tests**

Run: `pnpm vitest run src/data/dexie`
Expected: PASS - contract (about 20 tests) plus the two moved files.

If a `feed`/`watch` test times out: `liveQuery` only tracks reads made *inside* the querier, so make sure `readFeed`'s reads all happen within the function passed to `live()` (they do above). If `forNotes([])` hangs: `liveQuery` must still be given a querier that resolves, hence the `Promise.resolve([])`.

- [ ] **Step 6: Run the whole suite** (the re-export keeps the 30 old importers working)

Run: `pnpm test`
Expected: PASS, same count as before plus the new files.

- [ ] **Step 7: Commit**

```bash
git add -A src/data src/db
git commit -m "[ADD] LocalStore contract suite and the Dexie implementation; Dexie moves under src/data (ADR 0020)"
```

---

### Task 4: The in-memory implementation

**Files:**
- Create: `src/data/memory/MemoryLocalStore.ts`
- Test: `src/data/memory/MemoryLocalStore.test.ts`

**Interfaces:**
- Produces: `createMemoryLocalStore(): LocalStore`.

- [ ] **Step 1: Write the test**

```ts
// src/data/memory/MemoryLocalStore.test.ts
import { describeLocalStoreContract } from '../localStore.contract.ts';
import { createMemoryLocalStore } from './MemoryLocalStore.ts';

describeLocalStoreContract(async () => createMemoryLocalStore());
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/data/memory`
Expected: FAIL - cannot resolve `./MemoryLocalStore.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/memory/MemoryLocalStore.ts
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';
import type { Live } from '../live.ts';
import type { LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';

type Table = 'notes' | 'tags' | 'noteTags' | 'attachments' | 'meta';

const linkKey = (noteId: string, tagId: string) => `${noteId} ${tagId}`;

/**
 * A Local Store that persists nothing: plain Maps, atomic by being
 * single-threaded, live by re-reading after every write to a table a Live
 * depends on. It is the "cache only" configuration and what the contract
 * suite proves the interface against; the app's default is Dexie.
 *
 * Rows are handed back as the same objects they were given - there is no
 * structured clone here as there is in IndexedDB - so callers must treat what
 * they read as frozen, which they already do.
 */
export function createMemoryLocalStore(): LocalStore {
  const notes = new Map<string, Note>();
  const tags = new Map<string, Tag>();
  const noteTags = new Map<string, NoteTag>();
  const attachments = new Map<string, Attachment>();
  const meta = new Map<string, unknown>();

  const listeners = new Set<{ tables: readonly Table[]; fire: () => void }>();

  /** Tell every Live that reads one of `tables` to read again. */
  function changed(...tables: Table[]) {
    for (const l of listeners) if (l.tables.some((t) => tables.includes(t))) l.fire();
  }

  /** Coarse per-table invalidation is enough here: nothing is on disk to be slow. */
  function live<T>(tables: readonly Table[], read: () => T): Live<T> {
    return {
      subscribe(next) {
        const listener = { tables, fire: () => next(read()) };
        listeners.add(listener);
        // Asynchronous first delivery, like liveQuery, so subscribers cannot
        // observe a value before `subscribe` has returned.
        queueMicrotask(() => {
          if (listeners.has(listener)) listener.fire();
        });
        return () => listeners.delete(listener);
      },
    };
  }

  const tagsFor = (noteId: string): Tag[] =>
    [...noteTags.values()]
      .filter((l) => l.noteId === noteId)
      .flatMap((l) => {
        const t = tags.get(l.tagId);
        return t ? [t] : [];
      });

  const readFeed = (scope: NoteFeedScope): Note[] =>
    [...notes.values()]
      .filter((n) => n.state === scope.state)
      .filter((n) => !scope.tagId || noteTags.has(linkKey(n.id, scope.tagId)))
      .map((n) => ({ ...n, tags: tagsFor(n.id) }));

  const attachmentsFor = (noteId: string) => [...attachments.values()].filter((a) => a.noteId === noteId);

  function deleteLinksWhere(predicate: (l: NoteTag) => boolean) {
    for (const [key, l] of noteTags) if (predicate(l)) noteTags.delete(key);
  }

  return {
    notes: {
      get: async (id) => notes.get(id),
      list: async () => [...notes.values()],
      listByState: async (state) => [...notes.values()].filter((n) => n.state === state),
      listTrashedBefore: async (cutoff) =>
        [...notes.values()].filter((n) => n.trashedAt !== undefined && n.trashedAt < cutoff),
      feed: (scope) => live(['notes', 'tags', 'noteTags'], () => readFeed(scope)),
      add: async (note) => {
        if (notes.has(note.id)) throw new Error(`Note ${note.id} already exists`);
        notes.set(note.id, note);
        changed('notes');
      },
      put: async (note) => {
        notes.set(note.id, note);
        changed('notes');
      },
      update: async (id, change) => {
        const before = notes.get(id);
        if (!before) return null;
        const after = { ...before, ...change(before) };
        notes.set(id, after);
        changed('notes');
        return { before, after };
      },
      purge: async (id) => {
        const removedTags = [...noteTags.values()].filter((l) => l.noteId === id);
        const removedAttachments = attachmentsFor(id);
        notes.delete(id);
        deleteLinksWhere((l) => l.noteId === id);
        for (const a of removedAttachments) attachments.delete(a.id);
        changed('notes', 'noteTags', 'attachments');
        return { removedTags, removedAttachments };
      },
      restore: async (note, removed = {}) => {
        notes.set(note.id, note);
        for (const l of removed.removedTags ?? []) noteTags.set(linkKey(l.noteId, l.tagId), l);
        for (const a of removed.removedAttachments ?? []) attachments.set(a.id, a);
        changed('notes', 'noteTags', 'attachments');
      },
    },

    tags: {
      get: async (id) => tags.get(id),
      watch: (id) => live(['tags'], () => tags.get(id)),
      list: async () => [...tags.values()],
      all: () => live(['tags'], () => [...tags.values()]),
      findByName: async (name) => {
        const wanted = name.trim().toLowerCase();
        return [...tags.values()].find((t) => t.name.toLowerCase() === wanted);
      },
      add: async (tag) => {
        if (tags.has(tag.id)) throw new Error(`Tag ${tag.id} already exists`);
        tags.set(tag.id, tag);
        changed('tags');
      },
      put: async (tag) => {
        tags.set(tag.id, tag);
        changed('tags');
      },
      delete: async (id) => {
        tags.delete(id);
        deleteLinksWhere((l) => l.tagId === id);
        changed('tags', 'noteTags');
      },
      merge: async (sourceId, targetId) => {
        if (!tags.has(targetId)) throw new Error(`Cannot merge into unknown tag ${targetId}`);
        const now = new Date().toISOString();
        for (const l of [...noteTags.values()].filter((l) => l.tagId === sourceId)) {
          const key = linkKey(l.noteId, targetId);
          if (!noteTags.has(key)) {
            noteTags.set(key, { noteId: l.noteId, tagId: targetId, createdAt: l.createdAt, updatedAt: now });
          }
        }
        deleteLinksWhere((l) => l.tagId === sourceId);
        tags.delete(sourceId);
        changed('tags', 'noteTags');
      },
      forNote: (noteId) => live(['tags', 'noteTags'], () => tagsFor(noteId)),
      link: async (link) => {
        const key = linkKey(link.noteId, link.tagId);
        if (noteTags.has(key)) return;
        noteTags.set(key, link);
        changed('noteTags');
      },
      unlink: async (noteId, tagId) => {
        noteTags.delete(linkKey(noteId, tagId));
        changed('noteTags');
      },
      listLinks: async () => [...noteTags.values()],
    },

    attachments: {
      get: async (id) => attachments.get(id),
      watch: (id) => live(['attachments'], () => attachments.get(id)),
      list: async () => [...attachments.values()],
      forNote: (noteId) => live(['attachments'], () => attachmentsFor(noteId)),
      forNotes: (noteIds) => {
        const wanted = new Set(noteIds);
        return live(['attachments'], () => [...attachments.values()].filter((a) => wanted.has(a.noteId)));
      },
      add: async (attachment) => {
        if (attachments.has(attachment.id)) throw new Error(`Attachment ${attachment.id} already exists`);
        attachments.set(attachment.id, attachment);
        changed('attachments');
      },
      update: async (id, changes) => {
        const row = attachments.get(id);
        if (!row) return;
        attachments.set(id, { ...row, ...changes });
        changed('attachments');
      },
      delete: async (id) => {
        attachments.delete(id);
        changed('attachments');
      },
      sweepNote: async (noteId, keep) => {
        const kept = new Set(keep);
        const orphans = attachmentsFor(noteId).filter((a) => !kept.has(a.id));
        for (const a of orphans) attachments.delete(a.id);
        if (orphans.length) changed('attachments');
        return orphans.length;
      },
      sweepAll: async (referencedBy) => {
        const referenced = new Map([...notes.values()].map((n) => [n.id, new Set(referencedBy(n))]));
        const orphans = [...attachments.values()].filter((a) => !referenced.get(a.noteId)?.has(a.id));
        for (const a of orphans) attachments.delete(a.id);
        if (orphans.length) changed('attachments');
        return orphans.length;
      },
    },

    meta: {
      get: async <T,>(key: string) => meta.get(key) as T | undefined,
      set: async (key, value) => {
        meta.set(key, value);
        changed('meta');
      },
      delete: async (key) => {
        meta.delete(key);
        changed('meta');
      },
    },

    exportAll: async () =>
      ({
        notes: [...notes.values()],
        tags: [...tags.values()],
        noteTags: [...noteTags.values()],
        attachments: [...attachments.values()],
      }) satisfies Snapshot,
    replaceAll: async (snapshot) => {
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      for (const n of snapshot.notes) notes.set(n.id, n);
      for (const t of snapshot.tags) tags.set(t.id, t);
      for (const l of snapshot.noteTags) noteTags.set(linkKey(l.noteId, l.tagId), l);
      for (const a of snapshot.attachments) attachments.set(a.id, a);
      changed('notes', 'tags', 'noteTags', 'attachments');
    },
    clear: async () => {
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      meta.clear();
      changed('notes', 'tags', 'noteTags', 'attachments', 'meta');
    },
  };
}
```

- [ ] **Step 4: Run both contract files**

Run: `pnpm vitest run src/data`
Expected: PASS for both implementations. If Dexie and memory disagree on a case, the *contract* decides which is right: fix the implementation, never loosen the test.

- [ ] **Step 5: Commit**

```bash
git add src/data/memory
git commit -m "[ADD] In-memory LocalStore, the second implementation the contract runs against (ADR 0020)"
```

---

### Task 5: The provider, the test helper, and the bootstrap

**Files:**
- Create: `src/data/LocalStoreProvider.tsx`
- Create: `src/test/store.tsx`
- Modify: `src/test/renderRoute.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Test: `src/data/LocalStoreProvider.test.tsx`

**Interfaces:**
- Produces: `<LocalStoreProvider store>`, `useLocalStore(): LocalStore`; `testStore: LocalStore`, `clearStore(): Promise<void>`, `withStore(ui)`, `renderHookWithStore(hook)`; `App` takes `{ store: LocalStore }`.

- [ ] **Step 1: Write the provider test**

```tsx
// src/data/LocalStoreProvider.test.tsx
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LocalStoreProvider, useLocalStore } from './LocalStoreProvider.tsx';
import { createMemoryLocalStore } from './memory/MemoryLocalStore.ts';

describe('LocalStoreProvider', () => {
  it('hands the configured store to useLocalStore', () => {
    const store = createMemoryLocalStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocalStoreProvider store={store}>{children}</LocalStoreProvider>
    );
    const { result } = renderHook(() => useLocalStore(), { wrapper });
    expect(result.current).toBe(store);
  });

  it('throws outside a provider, because a silent default would be a second store', () => {
    expect(() => renderHook(() => useLocalStore())).toThrow(/LocalStoreProvider/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/data/LocalStoreProvider.test.tsx`
Expected: FAIL - cannot resolve `./LocalStoreProvider.tsx`.

- [ ] **Step 3: Write the provider**

```tsx
// src/data/LocalStoreProvider.tsx
import { createContext, type ReactNode, useContext } from 'react';
import type { LocalStore } from './LocalStore.ts';

const LocalStoreContext = createContext<LocalStore | undefined>(undefined);

/**
 * Hands the one Local Store to the tree (ADR 0020). Composed once, in
 * `main.tsx`: which implementation runs is a build-time decision made by
 * whoever deploys the app, never a runtime switch.
 */
export function LocalStoreProvider({ store, children }: { store: LocalStore; children: ReactNode }) {
  return <LocalStoreContext.Provider value={store}>{children}</LocalStoreContext.Provider>;
}

export function useLocalStore(): LocalStore {
  const store = useContext(LocalStoreContext);
  if (!store) throw new Error('useLocalStore must be used within a LocalStoreProvider');
  return store;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/data/LocalStoreProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the test helper** (replaces `src/test/db.ts` in Task 9; both exist until then)

```tsx
// src/test/store.tsx
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';

/**
 * The store every test renders against: the Dexie implementation on the
 * `fake-indexeddb` that `setup.ts` installs, so tests exercise the code path
 * users run. A test that only needs a store and never a Blob may build a
 * `createMemoryLocalStore()` of its own instead.
 */
export const testStore = createDexieLocalStore();

/** Empties every store between tests. */
export const clearStore = () => testStore.clear();

export function withStore(ui: ReactNode) {
  return <LocalStoreProvider store={testStore}>{ui}</LocalStoreProvider>;
}

export function renderWithStore(ui: ReactElement) {
  return render(withStore(ui));
}

export function renderHookWithStore<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => <LocalStoreProvider store={testStore}>{children}</LocalStoreProvider>,
  });
}
```

- [ ] **Step 6: Wrap `renderRoute` and the app**

In `src/test/renderRoute.tsx`, import `LocalStoreProvider` and `testStore` and wrap the tree so it matches `App.tsx`:

```tsx
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';
import { testStore } from '@/test/store.tsx';
// ...
  render(
    <LocalStoreProvider store={testStore}>
      <ThemeProvider>
        <PreferencesProvider>
          <ViewModeProvider>
            {/* biome-ignore lint/suspicious/noExplicitAny: the test router is not the app's registered one */}
            <RouterProvider router={router as any} />
          </ViewModeProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </LocalStoreProvider>
  );
```

In `src/App.tsx`, take the store as a prop and provide it outermost (the error boundary must be able to render even if a store method throws, and nothing above the store needs it):

```tsx
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';
import type { LocalStore } from '@/data/LocalStore.ts';
// ...
function App({ store }: { store: LocalStore }) {
  return (
    <LocalStoreProvider store={store}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        {/* unchanged inner tree */}
      </ThemeProvider>
    </LocalStoreProvider>
  );
}
```

In `src/main.tsx`, build the store once. This is the one line a fork changes (ADR 0020):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { createDexieLocalStore } from '@/data/dexie/DexieLocalStore.ts';
import App from './App.tsx';
import './i18n.ts';

// The Local Store the app runs on (ADR 0020). Dexie/IndexedDB is the default
// and the only shipped implementation that persists; see src/data/CLAUDE.md
// for bringing your own.
const store = createDexieLocalStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>
);
```

- [ ] **Step 7: Typecheck, run the suite, commit**

Run: `pnpm tsc -b --noEmit && pnpm test`
Expected: PASS. Any test that renders `<App />` directly needs `store={testStore}`; grep `<App ` under `src/` and fix those.

```bash
git add src/data/LocalStoreProvider.tsx src/data/LocalStoreProvider.test.tsx src/test/store.tsx src/test/renderRoute.tsx src/App.tsx src/main.tsx
git commit -m "[ADD] LocalStoreProvider; the app composes its store once in main.tsx (ADR 0020)"
```

---

### Task 6: Reroute the seven data hooks

**Files:**
- Modify: `src/hooks/data/useNoteActions.ts`, `useTagActions.ts`, `useAttachmentActions.ts`, `useNoteFeed.ts`, `useTags.ts`, `useTagsForNote.ts`, `useNoteAttachments.ts`
- Modify (tests): the seven `src/hooks/data/*.test.ts` files

**Interfaces:**
- Consumes: `useLocalStore`, `useLive`, `newNote`.
- Produces: unchanged public hook shapes. `NoteFeedScope` is now re-exported from `useNoteFeed.ts` (`export type { NoteFeedScope } from '@/data/LocalStore.ts'`) so existing importers keep working.

- [ ] **Step 1: Convert the hook tests first** - the same three mechanical substitutions in every file:

1. `import { db } from '@/db/db.ts'` -> `import { testStore, clearStore, renderHookWithStore } from '@/test/store.tsx'`; `import { clearNotesDb } from '@/test/db.ts'` goes; `afterEach(clearNotesDb)` -> `afterEach(clearStore)`.
2. `renderHook(() => useX())` -> `renderHookWithStore(() => useX())`.
3. Seeding and asserting through Dexie becomes the store: `db.notes.add(n)` -> `testStore.notes.add(n)`; `db.notes.get(id)` -> `testStore.notes.get(id)`; `db.noteTags.toArray()` -> `testStore.tags.listLinks()`; `db.attachments.where('noteId').equals(id).toArray()` -> `(await testStore.attachments.list()).filter((a) => a.noteId === id)`; `db.tags.toArray()` -> `testStore.tags.list()`; `db.noteTags.add(l)` -> `testStore.tags.link(l)`.

Run: `pnpm vitest run src/hooks/data`
Expected: FAIL - the hooks still call Dexie but render under a provider; several fail on `useLocalStore` not being used yet, or pass vacuously. Either way, proceed.

- [ ] **Step 2: Rewrite `useNoteActions.ts`** - same exports, bodies over the store

```ts
import { useCallback } from 'react';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { PurgedRelations } from '@/data/LocalStore.ts';
import { newNote } from '@/lib/new-note.ts';
import type { Note } from '@/models.ts';

export const TRASH_GRACE_DAYS = 30;

export type LifecycleSnapshot = Pick<Note, 'state' | 'pinnedAt' | 'trashedAt' | 'updatedAt'>;

function snapshotOf(note: Note): LifecycleSnapshot {
  return { state: note.state, pinnedAt: note.pinnedAt, trashedAt: note.trashedAt, updatedAt: note.updatedAt };
}

function graceCutoff(days = TRASH_GRACE_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// The functions close over the store from context, which the provider creates
// once, so they are memoized on it alone. Stable identities matter:
// NoteEditorDialog's autosave effect depends (transitively) on these.
export function useNoteActions() {
  const store = useLocalStore();

  const createNote = useCallback(
    async (data: Partial<Note>) => {
      const note = newNote(data);
      await store.notes.add(note);
      return note;
    },
    [store]
  );

  const restoreNote = useCallback(
    async (note: Note, removed: Partial<PurgedRelations> = {}) => {
      await store.notes.restore(note, removed);
      return note;
    },
    [store]
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      const result = await store.notes.update(id, () => ({ ...updates, updatedAt: new Date().toISOString() }));
      return result?.after ?? null;
    },
    [store]
  );

  const purgeNote = useCallback((id: string) => store.notes.purge(id), [store]);

  // Every transition is the same shape: snapshot the lifecycle fields, write
  // the new ones, in one atomic update. Sharing one implementation keeps the
  // "snapshot before write" invariant in one place.
  const transition = useCallback(
    async (id: string, next: (note: Note) => Partial<LifecycleSnapshot>): Promise<LifecycleSnapshot | null> => {
      const result = await store.notes.update(id, (note) => ({ ...next(note), updatedAt: new Date().toISOString() }));
      return result ? snapshotOf(result.before) : null;
    },
    [store]
  );

  const revertLifecycle = useCallback(
    async (id: string, snapshot: LifecycleSnapshot) => {
      // Spread rather than merge: `pinnedAt`/`trashedAt` are absent-means-unset,
      // so an undo must be able to clear a field the transition set.
      const result = await store.notes.update(id, () => ({
        state: snapshot.state,
        pinnedAt: snapshot.pinnedAt,
        trashedAt: snapshot.trashedAt,
        updatedAt: snapshot.updatedAt,
      }));
      return result?.after ?? null;
    },
    [store]
  );

  const pinNote = useCallback((id: string) => transition(id, () => ({ pinnedAt: new Date().toISOString() })), [transition]);
  const unpinNote = useCallback((id: string) => transition(id, () => ({ pinnedAt: undefined })), [transition]);
  const archiveNote = useCallback(
    (id: string) => transition(id, () => ({ state: 'archived', pinnedAt: undefined, trashedAt: undefined })),
    [transition]
  );
  const trashNote = useCallback(
    (id: string) => transition(id, () => ({ state: 'trashed', trashedAt: new Date().toISOString(), pinnedAt: undefined })),
    [transition]
  );
  const restoreToActive = useCallback(
    (id: string) => transition(id, () => ({ state: 'active', trashedAt: undefined })),
    [transition]
  );

  const purgeExpiredTrash = useCallback(
    async (graceDays = TRASH_GRACE_DAYS) => {
      const expired = await store.notes.listTrashedBefore(graceCutoff(graceDays));
      const stale = expired.filter((note) => note.state === 'trashed');
      for (const note of stale) await purgeNote(note.id);
      return stale.length;
    },
    [store, purgeNote]
  );

  const emptyTrash = useCallback(async () => {
    const trashed = await store.notes.listByState('trashed');
    for (const note of trashed) await purgeNote(note.id);
    return trashed.length;
  }, [store, purgeNote]);

  return {
    createNote,
    restoreNote,
    updateNote,
    purgeNote,
    revertLifecycle,
    pinNote,
    unpinNote,
    archiveNote,
    trashNote,
    restoreToActive,
    purgeExpiredTrash,
    emptyTrash,
  };
}
```

Keep the existing doc comments on `TRASH_GRACE_DAYS`, `LifecycleSnapshot`, `purgeNote` and the lifecycle block; only the bodies above change.

- [ ] **Step 3: Rewrite `useTagActions.ts`**

```ts
import { v4 as uuid } from 'uuid';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { Tag } from '@/models.ts';

export type TagChanges = { name?: string; color?: string };

export function useTagActions() {
  const store = useLocalStore();

  const createTag = async (name: string, color?: string) => {
    const trimmed = name.trim();
    const existing = await store.tags.findByName(trimmed);
    if (existing) return existing;
    const now = new Date().toISOString();
    const newTag: Tag = { id: uuid(), name: trimmed, color, createdAt: now, updatedAt: now };
    await store.tags.add(newTag);
    return newTag;
  };

  const updateTag = async (id: string, changes: TagChanges) => {
    const tag = await store.tags.get(id);
    if (!tag) return null;
    const updatedTag: Tag = {
      ...tag,
      ...('name' in changes ? { name: changes.name?.trim() || tag.name } : {}),
      ...('color' in changes ? { color: changes.color } : {}),
      updatedAt: new Date().toISOString(),
    };
    await store.tags.put(updatedTag);
    return updatedTag;
  };

  const deleteTag = (id: string) => store.tags.delete(id);

  const mergeTags = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    await store.tags.merge(sourceId, targetId);
  };

  const addTagToNote = async (noteId: string, tagId: string) => {
    const now = new Date().toISOString();
    await store.tags.link({ noteId, tagId, createdAt: now, updatedAt: now });
  };

  const removeTagFromNote = (noteId: string, tagId: string) => store.tags.unlink(noteId, tagId);

  return { createTag, updateTag, deleteTag, mergeTags, addTagToNote, removeTagFromNote };
}
```

Keep the existing doc comments (idempotent-by-name, `updateTag` patch semantics, the merge rationale) above the corresponding functions.

- [ ] **Step 4: Rewrite `useAttachmentActions.ts`** - `createAttachment`, `cloneAttachment` build the row exactly as today then `store.attachments.add(att)`; the rest map one-to-one:

```ts
const store = useLocalStore();
// createAttachment: unchanged body, then `await store.attachments.add(att);` - deps [store]
const getAttachment = useCallback((id: string) => store.attachments.get(id), [store]);
const deleteAttachment = useCallback((id: string) => store.attachments.delete(id), [store]);
// cloneAttachment: unchanged body, then `await store.attachments.add(clone);` - deps [store]
const updateAttachment = useCallback(
  (id: string, changes: { blob?: Blob; preview?: string; thumbnail?: Blob; duration?: number }) =>
    store.attachments.update(id, { ...changes, updatedAt: new Date().toISOString() }),
  [store]
);
const collectOrphans = useCallback(
  (noteId: string, referencedIds: string[]) => store.attachments.sweepNote(noteId, referencedIds),
  [store]
);
const collectStartupOrphans = useCallback(
  () => store.attachments.sweepAll((note) => extractAttachmentIds(note.body)),
  [store]
);
```

- [ ] **Step 5: Rewrite the four live hooks**

`useTags.ts`:

```ts
import { useLive } from '@/data/useLive.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { Tag } from '@/models.ts';

export function useTags(): Tag[] {
  const store = useLocalStore();
  return useLive(() => store.tags.all(), [store]) ?? [];
}
```

`useTagsForNote.ts` (keep its doc comment):

```ts
export function useTagsForNote(noteId: string | null | undefined): Tag[] {
  const store = useLocalStore();
  const tags = useLive(() => (noteId ? store.tags.forNote(noteId) : EMPTY), [store, noteId]);
  return tags ?? [];
}
// Module-level, so a note with no id gets a Live that delivers once and never again:
const EMPTY: Live<Tag[]> = { subscribe: (next) => { queueMicrotask(() => next([])); return () => {}; } };
```

`useNoteAttachments.ts` - replace both `useLiveQuery` calls, everything else (the signature cache, the Map identity guarantee, all comments) stays byte-for-byte:

```ts
const store = useLocalStore();
// useNoteAttachments:
const rows = useLive(() => (noteId ? store.attachments.forNote(noteId) : EMPTY_ROWS), [store, noteId]);
// useAttachmentsByNote:
const rows = useLive(() => store.attachments.forNotes(noteIds), [store, key]);
```

with `EMPTY_ROWS: Live<Attachment[]>` defined the same way as `EMPTY` above. The `forNotes([])` case is handled by the store (contract: delivers `[]`).

`useNoteFeed.ts` - replace the `useLiveQuery` block (lines 147-186) with:

```ts
const store = useLocalStore();
const notesInScope = useLive(() => store.notes.feed(scope), [store, scope.state, scope.tagId]);

// A note's tags ride along with it from the store: the index needs their
// names at build time, and the pill filters need their ids.
const entries = useMemo(
  () =>
    notesInScope?.map<FeedEntry>((note) => ({
      note,
      tagIds: (note.tags ?? []).map((tag) => tag.id),
      tagNames: (note.tags ?? []).map((tag) => tag.name),
    })),
  [notesInScope]
);
```

and add at the top `export type { NoteFeedScope } from '@/data/LocalStore.ts';`, deleting the local `NoteFeedScope` type. Everything from `const index = useMemo(...)` down is unchanged.

- [ ] **Step 6: Run the hook tests**

Run: `pnpm vitest run src/hooks/data`
Expected: PASS - including `useNoteAttachments.test.ts` (Map identity) and `useNoteFeed.test.ts` (held rank). If a feed test that previously relied on `useLiveQuery` returning `undefined` on scope change now sees the old list for a tick, the test is asserting on the old adapter's behaviour rather than the feed's contract - update the assertion to `waitFor` the new scope's ids.

- [ ] **Step 7: Run everything, typecheck, commit**

Run: `pnpm tsc -b --noEmit && pnpm check && pnpm test`
Expected: PASS.

```bash
git add src/hooks/data
git commit -m "[EDIT] Data hooks read and write the LocalStore instead of Dexie (ADR 0020)"
```

---

### Task 7: Reroute the non-hook call sites

**Files:**
- Modify: `src/lib/backup.ts`, `src/lib/backup.test.ts`
- Modify: `src/components/notes/NoteEditorDialog.tsx`
- Modify: `src/components/nav/useTopbar.ts`
- Modify: `src/routes/tag.$id.tsx`
- Modify: `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx`
- Modify (tests): `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`, `src/components/notes/NoteEditorDialog.test.tsx`, `src/components/notes/NoteEditorDialog.realEditor.test.tsx`

**Interfaces:**
- Produces: `buildBackupZip(store: LocalStore)`, `restoreBackup(store: LocalStore, parsed: ParsedBackup)`.

- [ ] **Step 1: Update `backup.test.ts`** - every `buildBackupZip()` becomes `buildBackupZip(testStore)`, every `restoreBackup(p)` becomes `restoreBackup(testStore, p)`, Dexie seeds/asserts become store calls per the Task 6 substitution table. Any assertion that a backup carries a `preferences` settings row is deleted: the manifest keeps a `settings` array for old archives, and new exports write it empty.

Run: `pnpm vitest run src/lib/backup.test.ts`
Expected: FAIL - signatures.

- [ ] **Step 2: Rewrite the two store-touching functions in `backup.ts`**

```ts
import type { LocalStore } from '@/data/LocalStore.ts';

export async function buildBackupZip(store: LocalStore): Promise<Blob> {
  const { notes, tags, noteTags, attachments } = await store.exportAll();
  // ... the blob/thumbnail/entries code is unchanged ...
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
  // ...
}

export async function restoreBackup(store: LocalStore, { manifest, files }: ParsedBackup): Promise<void> {
  const attachments: Attachment[] = /* unchanged */;
  await store.replaceAll({
    notes: manifest.notes as unknown as Note[],
    tags: manifest.tags as unknown as Tag[],
    noteTags: manifest.noteTags as unknown as NoteTag[],
    attachments,
  });
}
```

`manifest.settings` from an old archive is read and ignored. Update the function's doc comment to say so. Callers: grep `buildBackupZip(`/`restoreBackup(` under `src/components/settings/` and pass `useLocalStore()` from the component. Remove the now-unused `Setting` import from `backup.ts`.

- [ ] **Step 3: The four component/route lookups**

`NoteEditorDialog.tsx:137`: `const store = useLocalStore();` near the other hooks, then `void store.notes.get(noteId).then((n) => {` with `store` added to that effect's deps.

`useTopbar.ts`:

```ts
const store = useLocalStore();
const tag = useLive(() => (tagId ? store.tags.watch(tagId) : NO_TAG), [store, tagId]);
```

with `const NO_TAG: Live<Tag | undefined> = { subscribe: (next) => { queueMicrotask(() => next(undefined)); return () => {}; } };` at module level.

`tag.$id.tsx`: `const tag = useLive(() => store.tags.watch(id), [store, id]);`

`ExcalidrawNodeView.tsx`: keep the `undefined = loading, null = missing` contract:

```ts
const store = useLocalStore();
const rows = useLive(() => (attachmentId ? store.attachments.watch(attachmentId) : NONE), [store, attachmentId]);
const row = rows === undefined ? undefined : (rows ?? null);
```

(`NONE` delivers `undefined` once, same shape as `NO_TAG`). Note `useLive` cannot tell "loading" from "delivered undefined"; the node view only distinguishes loading for its skeleton, and a delivered `undefined` renders as missing, which is right - so simply use `row = useLive(...)`, and treat `undefined` as before. Check `ExcalidrawNodeView.test.tsx` for which it asserts and keep that.

- [ ] **Step 4: Convert the three affected component tests** with the Task 6 substitutions; anything that `render(...)`s the component wraps it in `withStore(...)`.

- [ ] **Step 5: Run, typecheck, commit**

Run: `pnpm tsc -b --noEmit && pnpm check && pnpm test`
Expected: PASS.

```bash
git add src/lib/backup.ts src/lib/backup.test.ts src/components src/routes
git commit -m "[EDIT] Backup, editor dialog, topbar, tag route and drawing view go through the LocalStore (ADR 0020)"
```

---

### Task 8: Preferences to `localStorage`; Prop baselines to `meta`

**Files:**
- Modify: `src/context/PreferencesProvider.tsx`, `src/context/PreferencesProvider.test.tsx`
- Modify: `src/lib/tour/props.ts`, `src/lib/tour/props.test.ts`
- Modify: `src/context/TourProvider.tsx`, `src/context/TourProvider.test.tsx`
- Create: `src/data/dexie/legacyPreferences.ts`, `src/data/dexie/legacyPreferences.test.ts`
- Modify: `src/data/dexie/DexieLocalStore.ts` (call the migration on creation)

**Interfaces:**
- Produces: `PREFERENCES_STORAGE_KEY = 'preferences'`; `usePreferences()` returns `{ preferences, setPreference }` (no `hydrated`); `TourProp` and `TOUR_PROPS_META_KEY = 'tourProps'` move to `src/lib/tour/props.ts`; `createProps(store, t)`, `rebaseProp(store, props, id)`, `purgeProps(store, purgeNote, props)`, `readProps(store)`, `writeProps(store, props)`.

- [ ] **Step 1: Write the migration test**

```ts
// src/data/dexie/legacyPreferences.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { NotesDB } from './db.ts';
import { migrateLegacyPreferences } from './legacyPreferences.ts';

describe('migrateLegacyPreferences', () => {
  afterEach(() => localStorage.clear());

  it('moves the blob to localStorage, the Prop baselines to meta, and deletes the row', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    const props = [{ id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' }];
    await db.settings.put({ key: 'preferences', value: { version: 2, density: 'compact', tourProps: props } });

    await migrateLegacyPreferences(db);

    expect(JSON.parse(localStorage.getItem('preferences') ?? 'null')).toEqual({ version: 2, density: 'compact' });
    expect((await db.settings.get('tourProps'))?.value).toEqual(props);
    expect(await db.settings.get('preferences')).toBeUndefined();
  });

  it('never overwrites preferences localStorage already holds', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    localStorage.setItem('preferences', JSON.stringify({ version: 2, density: 'comfortable' }));
    await db.settings.put({ key: 'preferences', value: { version: 2, density: 'compact', tourProps: [] } });
    await migrateLegacyPreferences(db);
    expect(JSON.parse(localStorage.getItem('preferences') ?? 'null')).toEqual({ version: 2, density: 'comfortable' });
    expect(await db.settings.get('preferences')).toBeUndefined();
  });

  it('is a no-op on a database with no row', async () => {
    const db = new NotesDB(`legacy-${crypto.randomUUID()}`);
    await expect(migrateLegacyPreferences(db)).resolves.toBeUndefined();
    expect(localStorage.getItem('preferences')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/data/dexie/legacyPreferences.test.ts`
Expected: FAIL - module missing.

- [ ] **Step 3: Write the migration and hook it into the factory**

```ts
// src/data/dexie/legacyPreferences.ts
import type { NotesDB } from './db.ts';

/** Where Preferences live now; `PreferencesProvider` reads and writes the same key. */
export const PREFERENCES_STORAGE_KEY = 'preferences';
const LEGACY_ROW_KEY = 'preferences';
const TOUR_PROPS_META_KEY = 'tourProps';

/**
 * One-shot: before ADR 0020 the Preferences blob was a row in the `settings`
 * table and carried the Tour's Prop baselines inside it. Split it: the user's
 * choices go to localStorage, the baselines stay in the store under `meta`,
 * and the old row is deleted so this runs exactly once per database.
 *
 * localStorage is never overwritten if it already holds preferences - a user
 * who changed a setting after the split must not have it undone by an old row.
 */
export async function migrateLegacyPreferences(db: NotesDB): Promise<void> {
  const row = await db.settings.get(LEGACY_ROW_KEY);
  if (!row) return;
  const { tourProps, ...preferences } = (row.value ?? {}) as Record<string, unknown>;
  await db.transaction('rw', db.settings, async () => {
    if (Array.isArray(tourProps) && tourProps.length > 0) {
      await db.settings.put({ key: TOUR_PROPS_META_KEY, value: tourProps });
    }
    await db.settings.delete(LEGACY_ROW_KEY);
  });
  if (localStorage.getItem(PREFERENCES_STORAGE_KEY) === null) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }
}
```

In `createDexieLocalStore`, run it once when the store is created and make the first `meta` read wait on it, so a Tour sweep cannot read `tourProps` before the split has landed:

```ts
export function createDexieLocalStore(db: NotesDB = defaultDb): LocalStore {
  const ready = migrateLegacyPreferences(db);
  // ...
    meta: {
      get: async <T,>(key: string) => {
        await ready;
        return (await db.settings.get(key))?.value as T | undefined;
      },
      set: async (key, value) => {
        await ready;
        await db.settings.put({ key, value });
      },
      // delete likewise
    },
```

Preferences themselves are read synchronously from `localStorage` at first render; the migration writes `localStorage` before the app's first paint in practice, but to make that true by construction, `main.tsx` awaits the store's first `meta` read before rendering:

```tsx
const store = createDexieLocalStore();
// Lets the one-shot legacy migration land before the first synchronous
// preferences read (src/data/dexie/legacyPreferences.ts).
void store.meta.get('tourProps').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>
  );
});
```

- [ ] **Step 4: Run the migration test**

Run: `pnpm vitest run src/data/dexie`
Expected: PASS.

- [ ] **Step 5: Rewrite `PreferencesProvider.tsx`**

Remove `tourProps` from `preferencesSchema` (and its doc comment; the concept moves to `props.ts`). Remove the `TourProp` export (Task 8 step 7 re-homes it). Replace the Dexie plumbing:

```tsx
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { PREFERENCES_STORAGE_KEY } from '@/data/dexie/legacyPreferences.ts';

// ... schema, migratePreferences, parsePreferences unchanged (minus tourProps) ...

function readStored(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return parsePreferences(raw === null ? undefined : JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

type PreferencesContextType = {
  preferences: Preferences;
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => Promise<void>;
};

/**
 * User Preferences (CONTEXT.md), one Zod-validated blob in localStorage beside
 * Theme and Locale (ADR 0020). Read synchronously, so the first render already
 * has the user's density and motion choice - there is no hydration step.
 *
 * Another tab's write arrives through the `storage` event, so two open tabs
 * cannot disagree.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readStored);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY || event.key === null) setPreferences(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback(async function setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]) {
    // Read-modify-write against storage, not React state: a second write in
    // the same tick must see the first, and localStorage is synchronous.
    const next = { ...readStored(), version: PREFERENCES_VERSION, [key]: value };
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  }, []);

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
```

`setPreference` stays `async` so no caller changes. Delete `PREFERENCES_KEY`.

Move `PREFERENCES_STORAGE_KEY` to be *defined* in `PreferencesProvider.tsx` and *imported* by `legacyPreferences.ts` if the dependency direction reads better; either way there is exactly one definition.

- [ ] **Step 6: Convert `PreferencesProvider.test.tsx`** - seeds via `db.settings.put({key:'preferences', value})` become `localStorage.setItem('preferences', JSON.stringify(value))`; assertions read `JSON.parse(localStorage.getItem('preferences'))`; `afterEach(() => localStorage.clear())`; tests about `hydrated` are deleted; the "unreadable blob yields defaults and is left on disk" test stays and now checks `localStorage` still holds the bad string. Add one test: a `storage` event with a new blob updates `preferences`.

Run: `pnpm vitest run src/context/PreferencesProvider.test.tsx`
Expected: PASS.

- [ ] **Step 7: Re-home the Prop baselines in `props.ts`**

Replace the `db` import and the `TourProp` import with the store, and add the two meta helpers:

```ts
import type { LocalStore } from '@/data/LocalStore.ts';
import { newNote } from '@/lib/new-note.ts';

/** One live Prop and the `updatedAt` baseline the sweep compares against. */
export type TourProp = { id: string; updatedAt: string };

/** `meta` key the baselines live under: store bookkeeping, not a Preference (ADR 0020). */
export const TOUR_PROPS_META_KEY = 'tourProps';

export const readProps = async (store: LocalStore): Promise<TourProp[]> =>
  (await store.meta.get<TourProp[]>(TOUR_PROPS_META_KEY)) ?? [];

export const writeProps = (store: LocalStore, props: TourProp[]) => store.meta.set(TOUR_PROPS_META_KEY, props);

/**
 * Seeds the three Props. The baselines are written *before* the rows, on
 * purpose: there is no cross-store transaction on the seam (ADR 0020), and a
 * crash between the two writes then leaves baselines for notes that do not
 * exist - which `purgeProps` already tolerates - rather than notes with no
 * baseline, which would never be swept.
 */
export async function createProps(store: LocalStore, t: Translate): Promise<TourProp[]> {
  const notes = PROP_SPECS.map((spec) =>
    newNote({ header: t(`onboarding.props.${spec.key}.header`), body: spec.body(t), color: spec.color })
  );
  const props = notes.map(({ id, updatedAt }) => ({ id, updatedAt }));
  await writeProps(store, props);
  for (const note of notes) await store.notes.add(note);
  return props;
}

export async function rebaseProp(store: LocalStore, props: TourProp[], id: string): Promise<TourProp[]> {
  const note = await store.notes.get(id);
  if (!note) return props;
  return props.map((prop) => (prop.id === id ? { id, updatedAt: note.updatedAt } : prop));
}

export async function purgeProps(store: LocalStore, purgeNote: PurgeNote, props: TourProp[]): Promise<string[]> {
  const purged: string[] = [];
  for (const prop of props) {
    const note = await store.notes.get(prop.id);
    if (!note || note.updatedAt !== prop.updatedAt) continue;
    await purgeNote(prop.id);
    purged.push(prop.id);
  }
  return purged;
}
```

The `CreateNote` type and the `record` parameter go. Update the module doc comment's rule 3 ("the baselines live in the preferences blob") to "the baselines live in the store's `meta`". `props.test.ts`: build a `createMemoryLocalStore()` per test (no Blob involved), pass it in, and replace the `record` spy with `await readProps(store)`.

- [ ] **Step 8: Update `TourProvider.tsx`**

- `const store = useLocalStore();` and drop `hydrated` from the `usePreferences()` destructure.
- `setProps` writes `await writeProps(store, next)` instead of `setPreference('tourProps', next)`.
- `rebaseProp(store, propsRef.current, id)`, `purgeProps(store, purgeNote, props)`, `createProps(store, (key) => t(key))` then `await setProps(props)` is no longer needed (createProps wrote them) - keep `propsRef.current = props`.
- The startup effect at line 509 read `preferences.tourProps`; it now reads the store once:

```ts
useEffect(() => {
  if (startedRef.current) return;
  let cancelled = false;
  void readProps(store).then(async (props) => {
    if (cancelled) return;
    propsRef.current = props;
    await sweep(props);
    // ... the existing auto-start logic, keyed on preferences.onboardingSeenAt ...
  });
  return () => {
    cancelled = true;
  };
}, [store, preferences.onboardingSeenAt, sweep, start, router]);
```

`TourProvider.test.tsx`: seeds of `tourProps` through the preferences row become `await testStore.meta.set('tourProps', [...])`; `db.notes.*` become `testStore.notes.*`; renders wrap in `withStore`.

- [ ] **Step 9: Run the Tour and context suites, then everything**

Run: `pnpm vitest run src/lib/tour src/context && pnpm tsc -b --noEmit && pnpm check && pnpm test`
Expected: PASS. Onboarding's Playwright spec (`e2e/onboarding.spec.ts`) is the real gate for the Tour; run `pnpm test:e2e --grep onboarding` if Playwright is installed on this machine, otherwise say so in the commit body.

- [ ] **Step 10: Commit**

```bash
git add src/context src/lib/tour src/data/dexie src/main.tsx
git commit -m "[EDIT] Preferences move to localStorage; the Tour's Prop baselines move to store meta (ADR 0020)"
```

---

### Task 9: The sweep, the fence, and the deletion

**Files:**
- Modify: the remaining tests that import `@/db/db.ts` or `@/test/db.ts` (list below)
- Delete: `src/db/db.ts`, `src/db/CLAUDE.md`, `src/db/PLAN.md` (moved in Task 10), `src/test/db.ts`
- Modify: `biome.json`, `package.json`

- [ ] **Step 1: Convert the remaining tests** with the Task 6 substitutions and `withStore`/`renderWithStore` around any `render(...)`:

`src/components/cards/NoteCard.test.tsx`, `src/components/DocumentPreferences.test.tsx`, `src/components/editor/toolbar/ToolbarLayoutEditor.test.tsx`, `src/components/layout.test.tsx`, `src/components/nav/BackButton.test.tsx`, `src/components/notes/DesktopCaptureBar.test.tsx`, `src/components/notes/NotesView.openNote.test.tsx`, `src/components/notes/QuickCaptureBar.test.tsx`, `src/components/settings/AppearanceSection.test.tsx`, `src/components/settings/QuickCaptureSection.test.tsx`, `src/components/tags/NoteTagsBar.test.tsx`, `src/lib/tour/targets.mounted.test.tsx`, `src/pages/labels.test.tsx`, `src/pages/settings.test.tsx`, `src/routes/routes.test.tsx`.

Tests that only used `db` to seed a `preferences` row switch to `localStorage.setItem('preferences', ...)` with `afterEach(() => localStorage.clear())`.

Run: `grep -rn "@/db/db\|test/db.ts\|dexie-react-hooks" src` - expected: no output.

- [ ] **Step 2: Delete the old locations and the dependency**

```bash
git rm src/db/db.ts src/test/db.ts
pnpm remove dexie-react-hooks
```

- [ ] **Step 3: Fence Dexie with Biome** - in `biome.json`, under `linter.rules.style` add:

```json
"noRestrictedImports": {
  "level": "error",
  "options": {
    "paths": {
      "dexie": "Dexie is an implementation detail of the Local Store. Import from '@/data/LocalStoreProvider.tsx' (ADR 0020).",
      "@/data/dexie/db.ts": "The Dexie instance is private to src/data/dexie. Go through the LocalStore (ADR 0020)."
    }
  }
}
```

and an override that lifts it where Dexie is allowed:

```json
{
  "includes": ["src/data/dexie/**", "src/test/store.tsx", "src/main.tsx"],
  "linter": { "rules": { "style": { "noRestrictedImports": "off" } } }
}
```

(`src/main.tsx` and `src/test/store.tsx` import `createDexieLocalStore`, not `db`; they are listed so the factory import is not caught if the rule is later widened to `@/data/dexie/**`.)

- [ ] **Step 4: Prove the fence bites** - temporarily add `import { db } from '@/data/dexie/db.ts';` to `src/hooks/data/useTags.ts`, run `pnpm check:ci`, confirm it errors with the message above, then remove the line.

- [ ] **Step 5: Full gate**

Run: `pnpm check:ci && pnpm tsc -b --noEmit && pnpm test && pnpm build`
Expected: all green. Note the test count in the commit body.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "[EDIT] Every test goes through the LocalStore; Dexie is fenced by Biome and dexie-react-hooks is gone (ADR 0020)"
```

---

### Task 10: Documentation

**Files:**
- Move + rewrite: `src/db/CLAUDE.md` -> `src/data/CLAUDE.md`; `src/db/PLAN.md` -> `src/data/PLAN.md`
- Modify: `CLAUDE.md` (root), `src/hooks/data/CLAUDE.md`, `src/context/CLAUDE.md`, `src/context/PLAN.md`, `README.md`, `docs/architecture/03-database.md`, `docs/adr/0001-local-first-storage-with-dexie.md`

- [ ] **Step 1: `src/data/CLAUDE.md`** - keep the schema table and migration rules from the old `src/db/CLAUDE.md` under a "Dexie implementation" heading, and add above it:

```md
# CLAUDE.md - `src/data` (the Local Store)

The seam every read and write of persisted data goes through ([ADR 0020](../../docs/adr/0020-the-local-store-seam.md)); terms in [CONTEXT.md](../../CONTEXT.md) (Local Store, Remote, Preference).

## Files

- `LocalStore.ts` - the interface. Domain-shaped, atomic per method, live reads return `Live<T>`.
- `live.ts`, `useLive.ts` - the observable contract and its one React adapter.
- `LocalStoreProvider.tsx` - context; `useLocalStore()` throws outside it.
- `localStore.contract.ts` - the behaviour every implementation must have. It is the spec; both implementations run it.
- `dexie/` - the default implementation (IndexedDB). `db.ts` is private to this folder, enforced by Biome's `noRestrictedImports`.
- `memory/` - the second implementation: nothing persists, atomic by being single-threaded. It is the "cache only" configuration and what proves the interface is not Dexie in disguise.
- `Remote.ts` - the sync seam, types only until M5 slice 3.

## Rules

- Nothing outside `dexie/` imports `dexie`; nothing outside `src/data` imports from `dexie/` except `main.tsx` and `src/test/store.tsx` (the two composition points).
- The store stamps nothing: ids and timestamps are the caller's (`lib/new-note.ts`).
- Search, sort and held rank live in `src/hooks/data`, in front of the seam.
- `meta` is bookkeeping about rows (Prop baselines; the sync cursor and Account in M5). Preferences are not here - they are in `localStorage` (`PreferencesProvider`).
- The Dexie table under `meta` is still called `settings`. No schema bump was spent on a rename.

## Bringing your own Local Store

1. Implement `LocalStore` in a folder beside `dexie/` and `memory/`.
2. Add a test file that calls `describeLocalStoreContract(() => makeYourStore())` and make it pass.
3. Change the one line in `src/main.tsx` that calls `createDexieLocalStore()`.

There is no runtime switch and there will not be one: a user-facing toggle to a non-persisting store is a data-loss button.
```

- [ ] **Step 2: `src/data/PLAN.md`** - the old `src/db/PLAN.md` content with "M5 slice 2" corrected to "M5 slice 3" and one new line under Sync metadata: "`rev`, the dirty marker and `tombstones` are added to the Dexie implementation *and* the memory implementation, with the dirty-row query added to the interface and the contract."

- [ ] **Step 3: Root `CLAUDE.md`** - in "Documentation map" replace the `src/db` link with `src/data`; in "Data layer" replace the first paragraph with: "All persistence goes through the `LocalStore` interface (`src/data/`, [ADR 0020](./docs/adr/0020-the-local-store-seam.md)); the default implementation is Dexie/IndexedDB, and Dexie is imported nowhere else (Biome enforces it). Domain models are in `src/models.ts`." Remove the mention of `useLiveQuery` in the hooks list ("live queries via `useLive`"). In "Theming", note that `PreferencesProvider` now reads `localStorage` synchronously.

- [ ] **Step 4: `src/hooks/data/CLAUDE.md`** - "Reactive reads wrap `useLiveQuery`" becomes "wrap `useLive` over a `Live<T>` from the Local Store"; the schema link points at `src/data/CLAUDE.md`; the conventions bullet "Relationship-aware deletes run in a `db.transaction`" becomes "are single atomic store methods (`notes.purge`, `tags.merge`, `tags.delete`)".

- [ ] **Step 5: `src/context/CLAUDE.md` and `PLAN.md`** - rewrite the `PreferencesProvider` section: localStorage, synchronous first read, `storage` event, no `hydrated`, `tourProps` gone (now `lib/tour/props.ts` + store `meta`). Delete the "ThemeProvider and ViewModeProvider still use localStorage" note (they now match). In `PLAN.md` delete line 17's "needs revisiting" item - it is resolved by ADR 0020: Preferences are per-Device and do not sync.

- [ ] **Step 6: `README.md`** - add a short "Storage" section: Dexie/IndexedDB by default; an in-memory store ships for tests and for deployments that want no persistence; link to `src/data/CLAUDE.md` for bringing your own.

- [ ] **Step 7: `docs/architecture/03-database.md`** - add a paragraph after the first: the app reaches the schema only through `LocalStore` (ADR 0020); two implementations; Preferences left the `settings` table. Change "Planned v5: sync metadata (M5 slice 2)" to slice 3.

- [ ] **Step 8: ADR 0001** - change its status line to `- Status: Accepted; amended by [ADR 0020](./0020-the-local-store-seam.md) (the app no longer touches Dexie directly)`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "[EDIT] Docs for the Local Store seam: src/data guide, bring-your-own-store, ADR 0001 amended"
```

---

## Self-review

- **Spec coverage.** ADR 0020: two seams (Tasks 2, 3-5 local; Task 2 remote types) - domain-shaped interface, `Live<T>`, atomic methods, no `transaction()` (Task 2); context composed once (Task 5); Dexie private + Biome fence (Tasks 3, 9); two implementations under one contract (Tasks 3, 4); no UI switch (Task 10 says so); Preferences to localStorage, `meta` for bookkeeping, Tour seed ordering (Task 8); `dexie-react-hooks` removed (Task 9); developer story (Task 10). Glossary already updated during the grill.
- **Types.** `NoteUpdate`, `PurgedRelations`, `AttachmentChanges`, `Snapshot`, `NoteFeedScope` defined in Task 2 and used by name in Tasks 3, 4, 6, 7. `createDexieLocalStore(db?)`, `createMemoryLocalStore()`, `describeLocalStoreContract(makeStore)`, `useLocalStore()`, `useLive(make, deps)`, `newNote(partial)`, `readProps/writeProps/createProps/rebaseProp/purgeProps(store, ...)` consistent throughout.
- **Known judgement calls, flagged rather than hidden:** `useLive` keeps the last value across a deps change (Task 1) - if `useNoteFeed.test.ts` disagrees, the test is asserting the old adapter, see Task 6 step 6. Old Backups' `settings` rows are read and ignored (Task 7); restoring toolbar layouts from a pre-ADR-0020 archive is a deliberate skip, add a `localStorage` write from `manifest.settings` if a user asks.
