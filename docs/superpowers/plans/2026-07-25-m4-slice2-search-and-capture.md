# M4 Slice 2 - Search & capture

**Status:** not started.

**Goal:** Turn the substring search into a real advanced search (fuzzy + sort + tag filters, all in typed URL state), and turn note creation into the Keep-style speed-dial with auto-starting media capture.

**Depends on:** Slice 1 (router + typed search params, Tags, lifecycle state for search scoping).

**Cross-cutting rule:** new strings ship `en` + `cs`. Land with tests.

## Context

Today `useSearchNotes` does `String.includes()` over header/description/body/checklist/dates/tags and returns an unranked, unsorted list; search state is component-local. Creation is a desktop "Take a note" bar + a mobile two-button pill (`NotesHome.tsx`). Attachment insertion (image/audio/video/file/excalidraw) already exists via the editor; this phase wires it to one-tap creation.

## Tasks

### Task 1 - Fuzzy ranked search (Fuse.js)

Decisions: `Fuse.js`; index header/bodyText/checklistText/tagNames weighted header>body; single relevance-ranked list that naturally includes close matches.

- [ ] Add dep `fuse.js`.
- [ ] Build a memoised search index: `{ id, header, bodyText (stripHtml(body)), checklistText, tagNames }`, rebuilt from the live notes+tags query. Reuse `stripHtml` (`src/lib/utils.ts`).
- [ ] Replace `useSearchNotes` internals with Fuse (weights: header highest, then body/checklist/tags; threshold tuned so typos surface). Return ranked results.
- [ ] Optionally highlight matched terms in card results (Fuse `includeMatches`).
- [ ] Tests: exact match ranks first; a typo'd query still returns the note; ranking is stable.

### Task 2 - Sort + tag-pill filters in typed URL state

Decisions: state in TanStack search params (Zod `validateSearch`); sort created/updated/title × dir (default updated-desc), pinned float first; multi-tag = AND.

- [ ] Define the search-params Zod schema for `/` (and `/tag/:id`): `q?`, `sort` (enum), `dir`, `tags: string[]`. Wire `validateSearch`.
- [ ] **Sort control** in the search bar's right corner → popover (created/updated/title, asc/desc). Writes the `sort`/`dir` params. Pinned notes always float to the top of the feed regardless of sort.
- [ ] **Tag-pill filters:** when search is active, show all tags as clickable pills (colour from `Tag.color`); clicking toggles the tag in `tags`. Multiple tags = **AND** (note must have all). Use `useNotesByTag`/`noteTags`.
- [ ] Combine: text (Fuse) ∩ tag-AND, then sort, respecting lifecycle scope (active/archived per route; trashed excluded from search).
- [ ] Tests: params round-trip through the URL; AND filtering; sort order incl. pinned-first; archived included in search, trashed excluded.

### Task 3 - Creation speed-dial + auto-capture

Decisions: mobile `＋` FAB → 5 actions replacing the pill; desktop inline icons; auto-start capture on select; Permissions-API pre-check; picture = `image/*` no `capture`.

- [ ] `NotesHome.tsx` mobile: replace the two-button pill with a single `＋` FAB that expands (Motion once Slice 4 lands; plain state until then) into labelled actions: **text / checklist / audio / drawing / picture**. Tap-outside collapses.
- [ ] Deep-link each into the editor with initial state + **auto-start capture**:
  - [ ] text → blank; checklist → `EMPTY_CHECKLIST_BODY` (existing).
  - [ ] audio → open + auto-start `useAudioRecorder`.
  - [ ] drawing → open + auto-open the Excalidraw dialog.
  - [ ] picture → open + auto-trigger the image picker.
- [ ] Desktop: keep the "Take a note" bar; add inline quick-action icons (checklist/picture/drawing/audio) on its right edge.
- [ ] **Permissions API** pre-check in `useAudioRecorder`: `navigator.permissions.query({name:'microphone'})` → only prompt when `'prompt'`; show a helpful hint on `'denied'`.
- [ ] Picture input: `accept="image/*"` with **no** `capture` (mobile sheet offers camera + gallery). `image/*` avoids the Linux-Chrome narrow-MIME grey-out.
- [ ] Tests: each action opens the editor in the right state; permission pre-check branches; picker attributes.

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual: search a typo and get the note; sort each mode (pinned still first); toggle tag pills (AND narrows); refresh/back-button preserve search state (URL); speed-dial each media path incl. the mic prompt appearing only when not already granted; picture offers camera+gallery on a phone.
