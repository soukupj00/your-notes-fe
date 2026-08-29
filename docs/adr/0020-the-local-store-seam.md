# 0020 - The app reads and writes a Local Store interface, never Dexie

- Status: Accepted (amends [ADR 0001](./0001-local-first-storage-with-dexie.md))
- Date: 2026-08-29

## Context

The app is open source and self-hosted, and a contributor may want their data somewhere other than IndexedDB: kept only in memory, or reconciled with a remote of their own rather than the Self-hosted Server this project ships.
Today Dexie is reached directly from 14 files - the six data hooks and eight others (`backup.ts`, `tour/props.ts`, `PreferencesProvider`, two route-level tag lookups, the Excalidraw node view, the editor dialog, and the test helper).
Two Dexie concepts leak with it: reactivity (`useLiveQuery`) and atomicity (`db.transaction`).

"Storage" in the request covered two different things, and the glossary now keeps them apart.
A **Local Store** is the copy on the Device, the only thing the app reads or writes directly; in a browser its durable form is IndexedDB, and the alternative that actually exists is *no persistence*.
A **Remote** is what a Local Store is reconciled with through Sync; S3 or a rival server is a Remote, not a Local Store, because a browser cannot make it reactive, transactional, or offline.

## Decision

**Two seams, matched to the two meanings.**

1. **`LocalStore`** (`src/data/LocalStore.ts`) is the only interface through which application code touches persisted data.
   It is shaped by the domain (`notes.feed(scope)`, `tags.merge`, `attachments.sweepAll`), not by tables.
   Live reads return a minimal observable, `Live<T>`, consumed through one `useLive` hook; every operation that must be atomic is one method, atomic inside its implementation, so there is no `transaction()` on the interface.
   Search, sort and held rank stay in front of the seam: they are pure functions over the list it returns, and the held rank exists to answer "is the user watching", which no store can know.
   The store is provided through React context, composed once in `main.tsx`; non-React modules take it as an argument.
   Dexie becomes a private of `src/data/dexie/`, enforced by Biome's `noRestrictedImports` rather than by convention.
2. **`Remote`** (push, pull, put/get blob) is what the sync engine talks to, and **`AccountService`** (sessions, Devices, Invites) is a separate, optional capability that only the Self-hosted Server implements.
   The types are declared now; the implementations belong to the M5 sync slices.

**Two Local Store implementations ship: Dexie (the default, the only one that persists) and in-memory.**
One contract test suite runs against both, so the interface is proven satisfiable by something that is not Dexie, and the memory store cannot drift into a test double that passes what Dexie would fail.
There is no user-facing switch: the choice is made by whoever builds the app, in `main.tsx`.

**Preferences leave the store.** A Preference is how the user holds the app, not something the app holds for the user; it joins Theme and Locale in `localStorage` and is no longer part of a Backup.
What remains behind the seam from the old `settings` row is bookkeeping about the store's own rows - the Tour's Prop baselines, and in M5 the sync cursor and attached Account - under `meta`.

## Consequences

- ADR 0001's "the app reads and writes Dexie directly" no longer holds; its choice of Dexie as the default Local Store does.
- The hooks in `src/hooks/data` keep their public shape; only their bodies change, so components are untouched.
- `dexie-react-hooks` leaves the dependency list.
- The Tour's seed no longer needs a cross-store transaction: the baselines are recorded *before* the Prop rows are written, and a crash in between leaves baselines for notes that do not exist, which the sweep already tolerates.
- Hook and component tests can run against the memory store, which is faster and free of the jsdom Blob quirk.
- `App` takes the store as a prop, which is what lets tests render it against any implementation.
- The developer story is three sentences: implement `LocalStore`, make the contract tests pass, change one line in `main.tsx`.

## Alternatives considered

**A table-shaped interface** (Dexie's `Table` API under another name). Rejected: no second implementation could honestly offer `where().equalsIgnoreCase()` or multi-store transactions.

**A generic `transaction(stores, fn)` on the interface.** Rejected for the same reason - it is the one capability a non-IndexedDB store cannot promise.

**A coarse per-table change bus instead of `Live<T>`.** Rejected: it loses `liveQuery`'s precision (a tag write would refire every attachment read) and gives each hook a list of dependencies that can drift.

**No seam; document Dexie as the Local Store.** Cheapest, and honest about browsers, but it leaves eight non-hook files poking Dexie directly, which was a smell before this request existed.
