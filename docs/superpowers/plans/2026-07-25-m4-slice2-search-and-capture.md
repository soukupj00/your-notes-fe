# M4 Slice 2 - Search & capture

**Status:** in progress - Tasks 1-2 done.

**Goal:** Turn the substring search into a real advanced search (fuzzy + sort + tag filters, all in typed URL state), and turn note creation into the Keep-style speed-dial with auto-starting media capture.

**Depends on:** Slice 1 (router + typed search params, Tags, lifecycle state for search scoping).

**Cross-cutting rule:** new strings ship `en` + `cs`. Land with tests.

## Context

Today `useSearchNotes` does `String.includes()` over header/description/body/checklist/dates/tags and returns an unranked, unsorted list; search state is component-local. Creation is a desktop "Take a note" bar + a mobile two-button pill (`NotesHome.tsx`). Attachment insertion (image/audio/video/file/excalidraw) already exists via the editor; this phase wires it to one-tap creation.

## Tasks

### Task 1 - Fuzzy ranked search (Fuse.js)

Decisions: `Fuse.js`; index header/bodyText/checklistText/tagNames weighted header>body; single relevance-ranked list that naturally includes close matches.

- [x] Add dep `fuse.js`.
- [x] Build a memoised search index in `src/lib/note-search.ts` (`createNoteSearchIndex` / `searchNotes`, a pure module the hook memoises), rebuilt from the live notes+tags query. Reuses `stripHtml`. **Correction:** no separate `checklistText` - Slice 1 removed `Note.checklist`, so checklist items *are* body HTML and `stripHtml(body)` already covers them. `description` is indexed at the lowest weight instead.
- [x] Replaced `useSearchNotes`' successor - the text-matching half of `useNoteFeed` - with Fuse (weights header .5 / body .25 / tagNames .15 / description .1, `threshold: 0.35`, `ignoreLocation: true`). Returns ranked results. **Placement correction:** the live query now depends on the **scope only**; the query text is applied after it against the memoised index, so a keystroke re-scores in memory instead of re-reading IndexedDB and rebuilding the index.
- [x] **Dropped, not deferred:** `createdAt`/`updatedAt` substring matching. Fuzzy-matching ISO timestamps is pure noise and no UI ever offered date search.
- [ ] ~~Optionally highlight matched terms in card results (Fuse `includeMatches`).~~ Skipped (explicitly optional): highlighting a *fuzzy* match means painting near-miss substrings, which reads as a rendering bug more than a hint. Revisit only if user testing asks for it.
- [x] Tests: `src/lib/note-search.test.ts` (exact-over-incidental ranking, typo tolerance, HTML never matches, tag-name match, stability) + a feed-level ranking/typo test in `useNoteFeed.test.ts`.

### Task 2 - Sort + tag-pill filters in typed URL state

Decisions: state in TanStack search params (Zod `validateSearch`); sort created/updated/title × dir (default updated-desc), pinned float first; multi-tag = AND.

- [x] Search-params Zod schema in `src/lib/note-search-params.ts` (`q?`, `sort`, `dir`, `tags`), wired as `validateSearch` on **all four feed routes** - `/`, `/archive`, `/trash` *and* `/tag/$id`, not just the two the plan named, because the search box is in the Navbar and would otherwise be live on routes that cannot honour it. Every field is optional and `.catch()`es individually: an untouched feed keeps a clean `/`, and `?sort=banana` loses only that field.
- [x] **`NotesProvider` deleted.** With the URL as the source of truth, the search context was a second, unshareable copy of the same state. `useNoteSearchState()` (`src/hooks/useNoteSearchState.ts`) replaces it; typing uses `replace: true` (a nine-character query is not nine history entries) while sort/tag changes push, so back undoes them. The Navbar hides the search box entirely off feed routes.
- [x] **Sort control** in the search bar's right corner → popover (`SortMenu.tsx`), field × direction. **Correction:** built on the existing single-select `ToggleGroup` (same primitive as the theme switcher, exposed by Radix as a radiogroup) rather than hand-rolled `menuitemradio` buttons - Biome's `useSemanticElements` was right that the hand-rolled ARIA was wrong (a `menuitemradio` needs a `menu` parent). Direction labels follow the field: "Newest first" for dates, "A to Z" for titles.
- [x] **Tag-pill filters** (`TagFilterBar.tsx`): shown only once a search is under way, tinted from `Tag.color`, toggling into `tags`; multiple tags = **AND**.
- [x] Combine: text (Fuse) ∩ tag-AND, then sort, within the lifecycle scope. Tag filtering runs over the *results* rather than the candidates, so a pill toggle never rebuilds the Fuse index and relevance order survives.
- [x] **Decision - pinned notes head the feed under search too**, not just under sort, and keep pin order (newest pin first) instead of adopting the sort: a pin shelf is arranged by hand, and sorting by title should not reshuffle it. This matches Keep, which shows a pinned section in search results.
- [x] Tests: `note-search-params.test.ts` (validation, defaults, round-trip), `useNoteFeed.test.ts` (every sort × direction, pinned-first under sort *and* search, tag AND, tags ∩ text), `routes.test.tsx` (URL → results, typing → URL, sort → URL + reorder, pill → URL + narrowing, no pills before searching, no search box on `/settings`).

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
