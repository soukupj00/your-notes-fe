# Kickoff prompt: Import from other apps

Paste the block below as the first message of a fresh agent session in this repo.

---

We are implementing **Import from other apps**: one additive Import button that replaces the replace-all Restore, taking the app's own Backup zip, a Google Keep Takeout zip, or a zipped Obsidian vault, and recognising which from the zip's contents.

The design is finished and must not be re-derived. Read, in this order, before touching code:

1. `CONTEXT.md`, section "Backup & import" - the vocabulary (Backup, Import, Source). Use these words exactly.
2. `docs/adr/0019-import-replaces-restore.md` - why Restore is gone and why Import is additive with upsert-by-id for Backups and file-wins on collision.
3. `docs/superpowers/specs/2026-08-21-m5-import-from-other-apps-design.md` - the full field-by-field mapping for Keep and Obsidian, source detection order, the confirm/toast flow, the suggested module layout under `src/lib/import/`, and the test list.
4. `src/lib/backup.ts` and `src/components/settings/BackupSection.tsx` - what exists. `parseBackupZip` stays (it becomes the Backup reader); `restoreBackup` is deleted.
5. `src/lib/attachment-html.ts`, `src/components/editor/extensions/attachments/createAttachmentNode.ts`, `src/lib/checklist.ts`, `src/lib/note-colors.ts` - the Body conventions the readers must emit (attachment nodes carry `data-attachment-id` and never a `src`; Checklist is `ul[data-type="taskList"]`; colours are tokens from `NOTE_COLORS`).
6. `CLAUDE.md` at the repo root, especially the TDD section: every reader, the detector, and the apply step land test-first with their tests in the same change.

Fixtures: real, scrubbed sample exports live (or will live) in `src/lib/import/fixtures/keep/` and `src/lib/import/fixtures/obsidian/`.
If they are not there yet, stop and ask for them - `docs/superpowers/specs/import-samples/README.md` describes what the user is producing.
Do not invent a Takeout JSON from memory; the format is undocumented and the fixture is the contract.

Order of work, one task at a time with a passing suite between them:

1. Spike (throwaway, not committed): confirm `@tiptap/markdown` converts Markdown to HTML headless under Vitest with the extension set from `src/components/editor/editor.tsx`, and that a `- [ ]` list comes out as `taskList`/`taskItem`. If it cannot, report back before choosing the fallback named in the design.
2. `detect.ts` + tests.
3. `keep.ts` + tests against the fixture, one assertion per row of the Keep mapping table.
4. `markdown.ts` + `obsidian.ts` + tests against the vault fixture, same rule.
5. `apply.ts` + `fake-indexeddb` tests: additive, upsert for Backup ids, tag match by name ignoring case, duplicates on foreign re-import, rollback on failure. Delete `restoreBackup` and migrate `backup.test.ts`.
6. `BackupSection.tsx`: Restore -> Import, confirm dialog with counts and the save-first checkbox defaulting per Source, unrecognised-zip toast. Strings in `public/locales/en` and `cs` (`src/i18n.test.ts` gates them). Update `CLAUDE.md`'s Backup paragraph.
7. `pnpm check`, `pnpm test`, `pnpm build`, then a manual import of each real sample in the browser.

Constraints: pnpm only; no new dependency besides `@tiptap/markdown` without asking; keep files under 500 lines; uuid v4 for new ids; ISO strings for every timestamp; never write to the database before the whole zip has been parsed and mapped; one Dexie transaction for the write.
If anything in the spec contradicts the fixture, the fixture wins for the data shape and the spec wins for the semantics - and say so in the session rather than quietly picking.
