# 0009 — Note lifecycle model (state, pin, color, trash)

- Status: Accepted
- Date: 2026-07-25

## Context

Through M3 a Note had no lifecycle: deletion was immediate and permanent (only a transient undo toast), and there was no pin, archive, colour, or recovery.
M4 adds Google-Keep-parity organisation - pinning, archiving, a recoverable trash, and per-note colour.
These must be represented on the Note unambiguously, be cheap to query for the feed/search/views, and stay forward-compatible with M5 sync.
Storage is Dexie/IndexedDB ([ADR 0001](./0001-local-first-storage-with-dexie.md)).

## Decision

Model lifecycle on the Note as:

- **`state: 'active' | 'archived' | 'trashed'`** — a single mutually-exclusive enum (default `'active'`). A Note is never two states at once.
- **`pinnedAt?: string`** — orthogonal to `state` (presence = pinned; the ISO timestamp orders pinned notes). Only meaningful while `active`; archiving or trashing clears it.
- **`color?: string`** — a palette **token key** (not a raw colour value), resolved per-Theme so the same note reads correctly in light, dark, and colour-blind themes.
- **`trashedAt?: string`** — set on entry to trash; a startup sweep **purges** trashed notes older than a 30-day grace period and reclaims their attachments, reusing the existing orphan-GC path. A manual "Empty trash" is also available.

Visibility: **Active** → feed + search; **Archived** → search (badged) + the Archive view, but not the feed; **Trashed** → the Trash view only, out of feed and search.
The dead, unused `checklist: string[]` field is removed in the same schema bump.
All new fields are optional or defaulted, so no data migration is required.
A `Tag.color?` token is added by the same bump (tags share the note-colour palette).

## Considered options

- **Booleans (`isPinned` / `isArchived` / `isTrashed`)** — rejected: allows illegal combinations (archived *and* trashed) that the enum makes unrepresentable.
- **Pin folded into the `state` enum** — rejected: pinning is orthogonal to archive/trash (an active note may or may not be pinned), so a separate field is the honest model.
- **Storing a raw colour value** — rejected: it would not adapt to theme or colour-blind variants; a token resolved per-Theme keeps colour decorative and accessible.

## Consequences

- Feed, search, and view queries filter on a single `state` field plus `pinnedAt` - simple and index-friendly.
- The grace-period purge introduces a background deletion the user does not trigger directly - mitigated by the 30-day window, a visible Trash view, and manual empty.
- One Dexie version bump adds four optional Note fields and an optional `Tag.color`, and removes `checklist`; no migration needed.
- Glossary terms are recorded in `CONTEXT.md` (State / Active / Archived / Trashed / Pinned / Color / Purge).
