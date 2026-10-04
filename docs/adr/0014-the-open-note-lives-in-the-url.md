# 0014 — The open note lives in the URL

- Status: Accepted
- Date: 2026-08-08

## Context

Which note was open was React state: `NotesView.tsx` held an `editing` object and passed it to `NoteEditorDialog`.
Radix's `Dialog` does not touch history, so the browser had no idea a note was open.

Three consequences, in descending order of how much they matter.

**The platform back button was wrong on the app's busiest screen.**
Below `sm:` the editor is not a modal at all - `NoteEditorDialog.tsx` renders it `top-0 left-0 h-[100dvh] w-full max-w-full rounded-none`, a full-screen sheet covering the whole app including the topbar.
It looks exactly like a page, so on Android the back gesture is the obvious way out of it.
What that gesture actually did was run the router back, navigating the feed out from under the sheet.
The app is `display: 'standalone'` (`vite.config.ts`), so an installed user has no browser chrome to correct the mistake with.

**A note could not be linked to.**
Every other piece of feed state had already moved into the URL in M4 slice 2 - `q`, `sort`, `dir`, `tags` - on the reasoning recorded in `CLAUDE.md`: *"a searched feed is now shareable, refresh-proof, and steppable with the back button."*
Which note is open is the same kind of state, and was the conspicuous exception.

**A reload lost the note.**
Refreshing with the editor open returned the user to the bare feed.

## Decision

**A `note` search param on the four feed routes names the open note, and a note's id is minted when its editor opens rather than when it is first saved.**

### `note` rides on the feed routes' existing `validateSearch`

It joins `noteSearchParamsSchema`, because that one schema is what all four feed routes validate against and a second `validateSearch` would be a second place for them to drift.
It is deliberately *not* part of `ResolvedNoteSearch`: it has no default, filtering has no opinion about it, and it is not feed state.
`useNoteSearchState` therefore has to carry it across writes explicitly, or typing in the search box - which on desktop sits behind the open editor - would close the note.

### Identity goes in the URL; intent does not

Opening a note can also carry one-shot instructions: start the camera, autoplay the first audio clip, seed an empty checklist.
Those describe a *gesture*, not a state.
Putting them in the URL would mean a reload re-opened the camera and a shared link replayed someone's audio.
They stay in React state, scoped to the note they were made about, so a back button landing on a different note cannot inherit them.

### The id is minted at open, not at first save

This is the part that is not obvious, and it replaces the design this was planned with.

The natural approach is `?note=new`, swapped for `?note=<uuid>` once `createNote` mints an id on the first meaningful keystroke.
That swap is unimplementable without a second bug: the id is the dialog's React `key` **and** the dependency of the effect that loads its content.
Changing it mid-session remounts the editor under a typing user's cursor and re-reads the note from the database on top of unsaved state.

So `NotesView` mints the uuid when it opens the editor and hands it down as `draftId`; `createNote` accepts an id instead of always generating one.
The draft is still not persisted until there is something worth persisting - guardrail 2 is untouched - but the id it *will* take is known from the first frame.

The URL is then stable for the whole life of an open, which removes the swap, the `replace`-versus-push question that came with it, and the remount.

### Closing pops, when there is something to pop

Closing runs `history.back()` if `useCanGoBack()`, and clears the param in place otherwise.

Neither branch alone is right.
Always replacing leaves two identical feed entries stacked, so the user's next back press appears to do nothing.
Always popping leaves the app entirely when the note was opened cold - a shared link, a reload, the PWA's `start_url` - which for an installed iOS user means relaunching it.

## Consequences

- **Back closes the editor**, on Android and on desktop alike. A modal that back dismisses is the web convention, so this is an improvement on desktop too, but it *is* a behaviour change there.
- **Notes are linkable and refresh-proof.**
- **A `note` param can point at nothing.** This is reachable without doing anything strange: closing an empty draft purges it (or never creates it), so the entry the user just came from names a note that is gone. Tapping forward or reloading a stale tab lands on it. The dialog reports this up rather than rendering an empty editor, and the param is cleared with `replace` so back does not walk straight into it again.
- **A draft's id is visible in the address bar before the note exists.** Copying that link and then discarding the draft yields a link to nothing, handled by the previous point.
- **`EditingState` became `NoteOpenRequest`.** It used to include `null` because it *was* the editor's state; it now only ever describes a start.
- **`NoteOpenRequest` split (2026-10-03, M6 slice 4): its id into `openNote(id | null, intent)`, its one-shot fields into `Intent`.** The gesture lives in `useOpenNote` as `{ id, isDraft, intent }` and is spent when the open ends, which is what makes Forward open the Note plain.
- **`isDraft` became `isNew`, and `draftId` went (2026-10-03, M6 slice 5).** Every open Note has a Draft (`CONTEXT.md`), so the flag that says a Start opened it is `isNew`; `NoteEditorDialog` takes the URL's `noteId` plus `isNew` in place of `noteId | null` plus `draftId`, and `createNoteDraft({ id, isNew }, deps)` in `src/lib/draft.ts` owns the row under that id.

## Alternatives considered

**A `/note/$id` route.**
Rejected. It buys a cleaner phone editor for a much larger change - feed scroll restoration, focus return to the originating card - and costs the desktop the Keep-style modal-over-feed, which is the right shape there. `?note=` gets the history entry and the deep link without touching the dialog, the draft queue, or the desktop layout.

**Leaving it in React state and intercepting `popstate`.**
Rejected. It would fix the back button without making a note linkable or refresh-proof, and it means maintaining a private history model beside the router's.
