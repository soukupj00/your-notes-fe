# M6 slice 5 - Draft

> **For agentic workers:** this slice is implemented inline by the session (one checkpoint tree per task, `git read-tree` hand-off), reviewed by Opus per the slice 4 method.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** one `NoteDraft` owns a Note's row for the life of one open, so the dialog stops threading `noteId | null` plus `ensureNoteId` through four children and `NoteTagsBar` stops keeping its own copy of the id.

**Architecture:** `createNoteDraft({ id, isNew }, deps)` in `src/lib/draft.ts` is a closure factory in the ADR 0022 style: it holds whether the row exists and one write queue, and offers `id`, `saved`, `ensureSaved()`, `save(header, body)` and `close(header, body, { keepEmpty })`.
The dialog keeps the typed text, the autosave timer and the status, builds the Draft once at mount and hands it to `NoteEditorBar`, `NoteTagsBar`, `ShareButton`, `useNoteReminder` and the Editor's `getNoteId`.
`useOpenNote`'s `isDraft` becomes `isNew`: every open Note has a Draft, a Start's is the new one.

**Tech stack:** React 19, Vitest, Biome, ESLint.

**Spec:** `PLAN.md` M6 slice 5 line; `CONTEXT.md` "Draft"; [ADR 0022](../../adr/0022-interfaces-and-closures-not-classes.md); the survey's ranked item 1 in `2026-10-02-refactor-survey.md`.

## Global constraints

- Behaviour-preserving under the existing tests; a bug fixed by construction rides with a pinning test, every other bug is a PLAN.md ticket.
- No classes; interfaces plus closure factories (ADR 0022).
- Comments short, why-only, for humans; nothing about styling.
- Files under 500 lines; `src/contract/index.ts` and `src/routeTree.gen.ts` are never edited.
- pnpm only; gates are `pnpm check:ci`, `pnpm lint` (0 errors, four pre-existing warnings), `pnpm exec tsc -b --noEmit`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
- Biome forbids `export` in `*.test.*` files; shared test helpers live in `src/test/`.
- Nothing is committed by the session; each task ends in a checkpoint tree (`checkpoint.sh`).

## Review focus

Failure modes the spec implies that the current tests do not pin, each with the task that pins it:

1. An act on a new Draft (label, colour, pin, Attachment, Reminder) racing the autosave creates one row, not two: Task 1 (`ensureSaved` and `save` in one tick) and Task 2 (the dialog's Editor race case stays).
2. A failed write must not fail every later write: today only `ensureNoteId` recovers its queue, the save path does not, so a failed autosave would also fail the close. Fixed by construction by the one queue, pinned in Task 1.
3. `ensureSaved()` on a new Draft writes what is typed so far, not blanks: Task 1, through the `content` dep.
4. Closing an emptied existing Note purges it; closing an empty Draft that carries a Reminder keeps it: Task 1 (`keepEmpty`), the dialog cases stay in Task 2.
5. The Attachments a Body dropped are swept on close only once a row exists: Task 1.
6. A new Draft fetches no Share list (nothing can be shared before the row exists), the same gate the null id gave: Task 2.

## Evidence (read 2026-10-03)

- `NoteEditorDialog.tsx` (371 lines): six refs (`idRef`, `headerRef`, `bodyRef`, `dirtyRef`, `timerRef`, `saveChainRef`), `persist` and `ensureNoteId` both create the row, `enqueueSave` chains `persist` without recovering from a rejection, `handleClose` flushes then purges or sweeps.
- Children taking `noteId: string | null` plus `ensureNoteId`: `NoteEditorBar`, `NoteTagsBar` (own `resolvedId` state), `ShareButton` (load effect gated on `noteId`), `useNoteReminder(ensureNoteId, headerRef, bodyRef, setReminder)`; the Editor takes `getNoteId`.
- `useOpenNote`: `OpenedNote = { id, isDraft, intent? }`; `NotesView` passes `noteId={opened?.isDraft ? null : openNoteId}` and `draftId={openNoteId}`.
- `useLatest(value)` gives a stable getter, written in a layout effect: the two content mirrors and their sync effect collapse into it.
- `requestPersistentStorage` is a once-per-session latch, a no-op without `navigator.storage`; it stays on the write path.
- `createNote(data: Partial<Note>)`, `updateNote(id, Partial<Note>)`, `purgeNote(id)`, `collectOrphans(noteId, referencedIds)` are the hook functions the Draft's deps are typed against structurally.
- Tests touched: `NoteEditorDialog.test.tsx` (584 lines, 22 draft renders, over the 500 limit, already a ticket), `NoteEditorDialog.realEditor.test.tsx` (3), `NoteTagsBar.test.tsx` (8), `ShareButton.test.tsx` (2), `NotesView.openNote.test.tsx` (the dialog mock reports `noteId` and `draftId`).
- Pre-existing, found on the way, ticketed in Task 4: closing an untouched existing Note runs `updateNote` and bumps `updatedAt` (`notes.update` has no no-change short-circuit); a platform Back unmounts the dialog without `handleClose`, so the pending debounce is dropped and an emptied Note is not purged.

---

### Task 1: `lib/draft.ts`

**Files:** create `src/lib/draft.ts`, `src/lib/draft.test.ts`.

**Produces:**

```ts
export const isEmpty: (header: string, body: string) => boolean; // moved from the dialog
export interface NoteDraft {
  readonly id: string;
  /** Whether the Note has its row yet; `ensureSaved()` makes it so. */
  readonly saved: boolean;
  ensureSaved(): Promise<string>;
  save(header: string, body: string): Promise<void>;
  close(header: string, body: string, options: { keepEmpty: boolean }): Promise<void>;
}
export function createNoteDraft(
  open: { id: string; isNew: boolean },
  deps: {
    content: () => { header: string; body: string };
    createNote: (note: { id: string; header: string; body: string }) => Promise<unknown>;
    updateNote: (id: string, change: { header: string; body: string }) => Promise<unknown>;
    purgeNote: (id: string) => Promise<unknown>;
    collectOrphans: (id: string, referenced: string[]) => Promise<unknown>;
  }
): NoteDraft;
```

Rules, each a test row:

- `save` on a new Draft with empty content writes nothing; with content it creates once, under `id`, then updates.
- `save` on an existing Note updates.
- `ensureSaved` on a new Draft creates with `content()` and answers `id`; on a saved one answers `id` without a write.
- `ensureSaved` and `save` called in one tick create one row (one queue).
- A rejected write rejects its caller and the next write still runs.
- `close`: flushes, then purges when the Note is empty and not `keepEmpty`, else sweeps with `extractAttachmentIds(body)`; a new Draft that never earned a row neither purges nor sweeps.
- `requestPersistentStorage` is asked after a write (import it; jsdom has no `navigator.storage`, so the test checks nothing about it).

- [ ] Write `draft.test.ts` (table-driven where rows share a shape; deferred promises for the race and the rejection).
- [ ] Run it red, write `draft.ts`, run it green.
- [ ] `pnpm check`, `pnpm lint`, `pnpm exec tsc -b --noEmit`; checkpoint `t1`.

### Task 2: the dialog and its children take the Draft

**Files:** modify `NoteEditorDialog.tsx`, `NoteEditorBar.tsx`, `tags/NoteTagsBar.tsx`, `ShareButton.tsx`, `useNoteReminder.ts`, `hooks/useOpenNote.ts`, `NotesView.tsx`; create `src/test/draft.ts`; modify `NoteEditorDialog.test.tsx`, `NoteEditorDialog.realEditor.test.tsx`, `tags/NoteTagsBar.test.tsx`, `ShareButton.test.tsx`, `NotesView.openNote.test.tsx`.

**Interfaces:**

- `NoteEditorDialog` props: `noteId: string` (always the URL's id), `isNew?: boolean` (a Start's Draft, no row yet; default an existing Note), `intent?`, `onClose`, `onNoteMissing?`. `draftId` goes.
- `useOpenNote`: `OpenedNote = { id, isNew, intent? }`; `NotesView` passes `noteId={openNoteId} isNew={opened?.isNew}`.
- `NoteEditorBar({ draft, ... })`, `NoteTagsBar({ draft, className })`, `ShareButton({ draft, className })`, `useNoteReminder(draft, content, setReminder)` where `content` is the dialog's `useLatest({ header, body })` getter.
- `src/test/draft.ts`: `testDraft({ id, isNew }, deps?)` builds a real Draft whose unexpected writes throw.

Steps:

- [ ] Dialog: `const content = useLatest({ header, body })`; `const [draft] = useState(() => createNoteDraft({ id: noteId, isNew }, { content, createNote, updateNote, purgeNote, collectOrphans }))`; delete `idRef`, `headerRef`, `bodyRef`, `saveChainRef`, the mirror effect, `persist`, `ensureNoteId`, `enqueueSave`; autosave skips when `!draft.saved && isEmpty(header, body)`; colour and pin await `draft.ensureSaved()`; `handleClose` is `await draft.close(header, body, { keepEmpty: reminder !== undefined }); onClose()`; the Editor gets `getNoteId={draft.ensureSaved}`; `!noteId` reads become `isNew`.
- [ ] `NoteTagsBar`: `useTagsForNote(draft.id)`, every act awaits `draft.ensureSaved()`; `resolvedId` and the throw go.
- [ ] `ShareButton`: load effect gated on `signedIn && draft.saved`, matches `draft.id`; `mint` awaits `draft.ensureSaved()`.
- [ ] `useNoteReminder(draft, content, setReminder)`.
- [ ] `useOpenNote` and `NotesView`: `isDraft` to `isNew`.
- [ ] Tests: draft renders become `noteId={crypto.randomUUID()} isNew`; `NoteTagsBar` and `ShareButton` tests take `testDraft(...)`; the `NotesView.openNote` mock reports `data-note-id` and `data-new`; one new `ShareButton` case: an unsaved Draft fetches no Share list (Review focus 6).
- [ ] `pnpm check`, `pnpm lint`, `pnpm exec tsc -b --noEmit`, `pnpm test`; checkpoint `t2`; Opus task review (the risky task), fix round if any, checkpoint `t2-done`.

### Task 3: the dialog's tests under 500 lines

**Files:** modify `NoteEditorDialog.test.tsx`; create `NoteEditorDialog.opening.test.tsx`.

- [ ] Collapse the near-identical pairs: the image-only and audio-only "kept on close" cases into one `it.each`; "discards an empty draft on close" and "still discards a truly empty draft on close" into one.
- [ ] Move the three opening suites ("the id in the URL", "the mobile app bar", "opening focus") to `NoteEditorDialog.opening.test.tsx` with the mocks they need (the Editor stand-in, `react-i18next`, `useReducedMotion`); both files under 500 lines.
- [ ] `pnpm test src/components/notes`, `pnpm check`; checkpoint `t3`.

### Task 4: docs, PLAN.md record, gates

**Files:** `CLAUDE.md` (data layer paragraph: a Draft sentence after the Intent one; Tags section: `NoteTagsBar` labels the Draft it is handed; Reminders section: `useNoteReminder` persists through `draft.ensureSaved()`), `docs/adr/0014-the-open-note-lives-in-the-url.md` (dated bullet: `isDraft` became `isNew`, `draftId` went, the Draft owns the row), `docs/adr/0021-reminders-are-handed-off-to-the-calendar.md` (the `ensureNoteId` mention), `PLAN.md` (slice 5 ✅ record with Harmless changes and Deviations; new tickets: closing an untouched Note bumps `updatedAt`; a platform Back skips the close path; `NoteEditorDialog.test.tsx` struck from the over-500 ticket), `CONTEXT.md` only if a term moved.

- [ ] Edit the docs; one sentence per line.
- [ ] Gates: `pnpm check:ci`, `pnpm lint`, `pnpm exec tsc -b --noEmit`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
- [ ] Checkpoint `t4`; whole-branch Opus review; one fix wave; Sonnet re-review; hand-off file.

## Self-review

- Spec coverage: `createNoteDraft` with `id`, `ensureSaved()`, `save(header, body)`, `close(...)` (Task 1); pure TypeScript tested without React (Task 1); dialog keeps state and timer and hands the Draft to the bar, labels, share and reminder (Task 2); `NoteTagsBar` loses its id copy (Task 2); `isDraft` becomes `isNew` (Task 2).
- Deviation from the PLAN.md sketch, recorded for the ✅ line: the factory takes `{ id, isNew }` rather than a bare id, because an existing Note's Draft opens saved; `saved` is exposed because the autosave status skip and the Share load gate need it; `close` takes `{ keepEmpty }` rather than the Reminder, so the Draft knows nothing about calendars.
- Type consistency: `content` is the same getter in the Draft's deps and in `useNoteReminder`; `getNoteId={draft.ensureSaved}` matches the Editor's `() => Promise<string>`.
