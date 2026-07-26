# M2 Slice 1 - Real notes CRUD UI

**Status:** retroactive record of shipped work. Landed in commit `091b7bf` ("[ADD] M2 notes CRUD UI - landing page, editor dialog, search, delete/undo"), 2026-07-21. Filename date is provisional, adjust per the team's records.

**Goal:** Replace the editor-only demo harness in `App.tsx` with a real notes home: a masonry feed backed by live IndexedDB data, a create/edit dialog with autosave, and delete-with-undo, plus full-text search over the note body.

## Context

Through M1 the app only rendered a standalone `Editor` instance seeded with placeholder content directly in `App.tsx`, alongside a "Seed Notes" debug button. The Dexie data layer (`src/db/db.ts`, ADR 0001) and its hooks (`useNotes`, `useNoteActions`, `useSearchNotes`) already existed, but nothing in the UI consumed them to actually list, create, edit, or delete notes. M2 wires the editor into real CRUD against that data layer and gives the app its first genuine "notes home" screen.

At this point in the domain model, `Note.checklist: string[]` was still a flat array of plain-text items with no per-item id (see `src/models.ts` as of `091b7bf`) - a Note's structured to-do data, distinct from a bullet/ordered list authored inside the rich-text `Body`. `CONTEXT.md` gained the **Body** glossary entry in this slice to make that distinction explicit; the M4 redefinition of Checklist (into an authored-in-body construct with per-item checked state) came later and does not apply here.

Scope note: this doc covers M2 only. The layout toggle (`ViewModeToggle` / grid vs. list), the mobile quick-capture bar (note + checklist buttons), the dialog's "Saved" status indicator, and the checklist-seeded draft flow landed in the very next commit (`da72b88`, M2.5 "Notes UX polish") and are documented separately.

## Tasks

### Task 1 - Replace the `App.tsx` demo with the notes home
- [x] Removed the hardcoded editor demo, placeholder HTML content, and "Seed Notes" debug button from `src/App.tsx`.
- [x] Mounted `NotesHome` (`src/components/notes/NotesHome.tsx`) inside `Layout`, wrapped in the existing `NotesProvider` and `ThemeProvider`.
- [x] Added `Toaster` (`src/components/ui/sonner.tsx`) at the app root to support the delete-undo toast (Task 4).
- [x] `NotesHome` renders a desktop "Take a note..." bar that opens a blank draft, and a mobile floating action button (`Plus` icon, `fixed right-4 bottom-20`) doing the same; both set `editing = { id: null }` to open `NoteEditorDialog`.

### Task 2 - Masonry feed with loading/empty/no-results states
- [x] `NoteContent` (`src/components/NoteContent.tsx`) renders notes from `useNotes()` (via `NotesProvider`) in a responsive CSS-columns masonry (`columns-1 sm:columns-2 lg:columns-3 xl:columns-4`), each `NoteCard` carrying `break-inside-avoid` so cards don't split across columns.
- [x] Loading state: while the live query hasn't resolved yet, renders skeleton placeholders (`Skeleton`) instead of a false empty state.
- [x] Empty state: distinguishes "no notes at all" (`notes.empty.title` / `notes.empty.subtitle`) from "search returned nothing" (`notes.noResults`) based on whether `query` is non-empty.
- [x] `NotesProvider` (`src/context/NotesProvider.tsx`) combines `useLiveQuery(() => db.notes.toArray())` with `useSearchNotes(query)`, switching to search results once `query` is non-empty, and exposes `{ notes, query, setQuery, loading }` via the `useNotes()` context hook.

### Task 3 - `NoteCard`: clickable card, rich preview, read-only checklist
- [x] `NoteCard` (`src/components/cards/NoteCard.tsx`) is a `role="button"` `Card` (not a native `<button>`, since it nests an overflow-menu trigger) with `tabIndex={0}` and Enter/Space keyboard activation, guarded so a key event that bubbled up from the portalled dropdown menu doesn't also open the editor.
- [x] Renders the note's `header` (or a screen-reader-only fallback title), and a clamped (`line-clamp-6`) rendered preview of `note.body` via `dangerouslySetInnerHTML` (accepted since the HTML is self-authored by the same editor, at local-only scale).
- [x] Renders a read-only preview of `note.checklist` (disabled checkboxes, capped at `CHECKLIST_PREVIEW_LIMIT = 4` items with a "+N more" line).
- [x] Overflow menu (`MoreVertical` trigger, `DropdownMenu`) offers Delete; both the trigger and menu content stop click propagation so they don't also trigger card-open.

### Task 4 - Delete with undo toast
- [x] `useNoteActions().deleteNote(id)` (`src/hooks/data/useNoteActions.ts`) runs in a Dexie transaction: captures the note's `noteTags` rows, deletes the note, deletes its `noteTags`, and returns the removed tags to the caller.
- [x] `useNoteActions().restoreNote(note, noteTags)` re-`put`s the original note (same id/timestamps) and `bulkPut`s its `noteTags` back, reproducing the exact prior state.
- [x] `NoteCard`'s delete handler shows a `sonner` toast (`notes.deleted`) with an `notes.undo` action that calls `restoreNote` with the captured note and tags.

### Task 5 - `NoteEditorDialog`: create/edit with debounced autosave
- [x] `NoteEditorDialog` (`src/components/notes/NoteEditorDialog.tsx`) is a responsive Radix `Dialog` - full-screen on mobile, centered (`sm:max-w-2xl`) on desktop - keyed by note id in the parent so it remounts (and resets state) per note.
- [x] Existing note content is loaded once via `db.notes.get(noteId)` in a `useEffect`, not a live query, so the live-query cursor never resets typing mid-edit (guardrail documented in the component's own comment).
- [x] New notes are held as an in-memory draft (`idRef.current = null`) and only persisted via `createNote` on the first meaningful change; subsequent edits go through `updateNote`. Saves are serialized through a `saveChainRef` promise chain so a draft is created exactly once.
- [x] Autosave is debounced 600ms (`AUTOSAVE_DELAY_MS`) after a dirty edit (`dirtyRef`), via `enqueueSave`.
- [x] On close, the dialog flushes the latest pending save, then discards the note if it ended up empty (`isEmpty(header, body)`: blank header and blank stripped body) - covering both a draft that was typed then cleared, and an existing note emptied out before closing.

### Task 6 - Full-text search over the body
- [x] `stripHtml` (`src/lib/utils.ts`) strips tags, decodes a handful of common entities, and collapses whitespace, turning the editor's HTML `body` into plain text - not a sanitizer, since the input is always the app's own editor output.
- [x] `Note.body: string` (rich-text HTML) added to `src/models.ts`, alongside the existing `checklist`, `header`, and `description` fields.
- [x] `useSearchNotes(query)` (`src/hooks/data/useSearchNotes.ts`) matches the query against `header`, `description`, the stripped `body`, `checklist` items, and the `createdAt`/`updatedAt` timestamps, plus notes reachable via a matching `Tag` name (through the `noteTags` join table). Results are de-duplicated by note id.

## Verification

- Test files landed with the slice: `src/lib/utils.test.ts` (`stripHtml`), `src/hooks/data/useNoteActions.test.ts` (body round-trip through create/update, delete+undo reproduces exact prior state), `src/hooks/data/useSearchNotes.test.ts` (search matches stripped body text, not raw tag names), `src/components/cards/NoteCard.test.tsx` (click/keyboard open, overflow-menu keyboard activation does not open the editor, delete-then-undo restores the note), `src/components/notes/NoteEditorDialog.test.tsx` (loads a note once and ignores later external writes, creates a draft on first meaningful change exactly once, creates a draft from a body-only edit, discards an empty draft on close, deletes a note emptied out before closing, persists an edit on close).
- Commit message records 83 total tests passing and a green gate: `tsc`, `biome check:ci`, `vitest`, `pnpm build`.
- i18n: `notes.*` keys added to `public/locales/en/translation.json` and `public/locales/cs/translation.json`.
