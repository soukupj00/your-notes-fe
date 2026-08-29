# Import from other apps - design

- Date: 2026-08-21
- Decision record: [ADR 0019](../../adr/0019-import-replaces-restore.md)
- Glossary: [CONTEXT.md](../../../CONTEXT.md), section "Backup & import"
- Sample files the user produces for fixtures: [`import-samples/`](./import-samples/)

## What is being built

One **Import** button in Settings (replacing Restore) that takes a zip, recognises its Source from the contents, and adds its Notes to the app.
Three Sources in this slice: the app's own Backup, Google Keep (Takeout), Obsidian (zipped vault).

## Semantics (settled, do not re-derive)

| Rule | Decision |
|------|----------|
| Operation | Additive. Nothing is ever cleared. Replace-all Restore is removed. |
| Own Backup | Upsert by id across notes, tags, noteTags, attachments, settings. File wins unconditionally. |
| Keep / Obsidian | Every Note is new (fresh uuid). Re-import = duplicates. No foreign id stored. |
| Tags | Match existing by case-insensitive name, else create. Applies to every Source. |
| Source detection | From zip entries only. Unrecognised zip -> toast, nothing written. |
| Validation | Whole zip parsed and mapped in memory *before* any write (as `parseBackupZip` does today). |
| Write | One Dexie `rw` transaction across all tables. |
| Confirm | One dialog: "Import N notes and M labels from {Source}?" + "save my current data first" checkbox, checked by default for Backup, unchecked for foreign Sources. |
| Result | One toast with the note count. No progress bar, no per-note picker, no report of dropped data. |
| Obsidian on mobile | A vault is a folder; file inputs cannot take folders on mobile. Instruction is "zip the vault folder". No `webkitdirectory`. |

## Source detection

Checked in this order on the unzipped entry names:

1. `manifest.json` at root -> **Backup** (existing `parseBackupZip`).
2. Any entry matching `Takeout/Keep/*.json` (any depth; Takeout may nest under a locale folder) -> **Keep**.
3. At least one `.md` entry and no match above -> **Obsidian**. A single top-level folder wrapping the vault (how OS zip tools behave) must be stripped.
4. Otherwise -> `unrecognised`.

## Google Keep mapping

Source of truth is the scrubbed real Takeout in `src/lib/import/fixtures/keep/` (to be produced, see `import-samples/`). Known shape of each `Takeout/Keep/<name>.json`:

| Keep field | Ours |
|------------|------|
| `title` | `header` (empty string -> undefined) |
| `textContent` | Body: each line-break-separated run -> `<p>` |
| `listContent[]` `{text, isChecked}` | Body: one Checklist (`ul[data-type="taskList"] > li[data-type="taskItem"][data-checked]`), in export order. Preserve order, do not sink. |
| `labels[].name` | Tags by name |
| `color` (`DEFAULT`, `RED`, `ORANGE`, `YELLOW`, `GREEN`, `TEAL`, `BLUE`, `CERULEAN`, `PURPLE`, `PINK`, `BROWN`, `GRAY`) | token: same-name lowercase where it exists; `CERULEAN`->`blue`, `BROWN`->`orange`, `DEFAULT`/unknown -> none |
| `isPinned` | `pinnedAt = updatedAt`, **only if** the Note ends up Active |
| `isArchived` | `state: 'archived'` |
| `isTrashed` | `state: 'trashed'`, `trashedAt = import time` (30-day clock restarts). Trashed beats archived if both. |
| `createdTimestampUsec`, `userEditedTimestampUsec` | `createdAt`, `updatedAt` (microseconds -> ISO) |
| `attachments[]` `{filePath, mimetype}` | Attachment from the sibling zip entry; `image/*` -> `image` (thumbnail via existing `image-thumbnail.ts`), `audio/*` -> `audio`, else `file`. Body gets the matching node (`<img data-attachment-id>` etc., see `createAttachmentNode.ts`). Missing entry -> skip the attachment, keep the Note. Note: Takeout sometimes lists `.jpeg` while the entry is `.jpg`; match on basename ignoring extension when exact match fails. |
| `annotations[]` `{url, title}` | Appended to Body as a trailing `<p>` of `<a href>` links (title as text, url as fallback) |
| `sharees` | Dropped |
| `isArchived` + `isPinned` | Archived clears pinned (app rule) |

The `.html` twin of each note is ignored. Drawings arrive as PNG attachments and need nothing special.

## Obsidian mapping

Source of truth: scrubbed vault in `src/lib/import/fixtures/obsidian/` (template in `import-samples/sample-vault/`).

| Vault thing | Ours |
|-------------|------|
| each `.md` (not under `.obsidian/`, `.trash/`) | one Note |
| filename minus `.md` | `header` |
| folder path segments | Tags, one per segment (`Work/Clients/acme.md` -> `Work`, `Clients`) |
| frontmatter `tags:` (list or string) | Tags |
| inline `#tag`, `#nested/tag` | Tags (`nested/tag` as one Tag named `nested/tag`); the `#tag` text stays in the Body |
| frontmatter `created:` / `updated:` if parseable | `createdAt` / `updatedAt`; else zip entry mtime for both |
| other frontmatter | dropped (not rendered into Body) |
| `![[file]]`, `![alt](path)` resolving to a zip entry | Attachment by mime (image/audio/video/file), node in Body. Resolve by exact relative path first, then by unique basename anywhere in the vault (Obsidian's "shortest path" rule). Missing -> leave the text as is. |
| `[[Note]]`, `[[Note|alias]]` | plain text `Note` / `alias` |
| `- [ ]` / `- [x]` | Checklist |
| everything else Markdown | via `@tiptap/markdown` with the app's own extension set so the HTML is exactly what the editor emits |
| empty `.md` | Note with header only |

Markdown -> HTML runs headless through TipTap (`@tiptap/markdown`, new dependency) using the same extensions `editor.tsx` registers, so task lists, code blocks, math and attachment nodes come out as the nodes the editor already understands. Verify in the spike that `@tiptap/markdown` can run without a DOM in Vitest (jsdom) and in a Worker if needed; if not, fall back to `marked` + DOMPurify and accept generic task-list HTML that a one-off post-pass rewrites into `taskList`/`taskItem`.

## Shape of the code (guidance, not a contract)

```
src/lib/import/
  index.ts          importZip(bytes) -> ParsedImport  (detect + dispatch, no writes)
  detect.ts         detectSource(entryNames) -> 'backup' | 'keep' | 'obsidian' | null
  keep.ts           readKeep(entries) -> ImportBatch
  obsidian.ts       readObsidian(entries) -> ImportBatch
  markdown.ts       markdownToBody(md) -> html       (TipTap headless)
  apply.ts          applyImport(batch)               (one transaction; upsert for backup, insert otherwise; tag match by name)
  fixtures/keep/    scrubbed Takeout
  fixtures/obsidian/ scrubbed vault
```

`ImportBatch` is one neutral shape every reader produces: notes (without ids for foreign Sources), tag names per note, attachments with bytes, plus `source` and whether ids are authoritative.
`backup.ts` keeps export; its `parseBackupZip` becomes the Backup reader, `restoreBackup` is deleted and replaced by the upsert path in `apply.ts`.

`BackupSection.tsx` loses Restore, gains Import. Strings in both `en` and `cs` (`src/i18n.test.ts` gates them).

## Tests

- Reader tests per Source against the scrubbed fixtures: counts, one assertion per mapped field in the table above, one per "has no home" rule (annotation in Body, sharee absent, missing embed left as text).
- `detect.ts` tests incl. the nested-folder and wrapped-vault cases.
- `apply.ts` with `fake-indexeddb`: additive (existing untouched), upsert (backup id collision overwritten), tag match by name case-insensitively, duplicate on re-import of a foreign Source, transaction rollback on failure.
- `BackupSection` component test: confirm dialog counts and checkbox default per Source, unrecognised zip toast.
- Markdown conversion: Blob/DOM needs may force `// @vitest-environment node` for byte round-trips (see memory note on jsdom + fake-indexeddb).

## Out of scope

Notion, Evernote, Simplenote, Apple Notes; note-to-note links; dedup on re-import; a dropped-data report; folder upload.
