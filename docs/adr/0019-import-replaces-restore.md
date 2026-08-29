# 0019 - Import replaces Restore: one additive operation for every Source

- Status: Accepted
- Date: 2026-08-21

## Context

Since M4 slice 1 the app has had a zip Backup and a replace-all Restore: Restore wipes every table and writes the Backup's rows in one transaction.
M4 deferred a "merge-style import" to pre-release.

The app now wants to take Notes from other apps - Google Keep first, Obsidian second - because the positioning is "a Google Keep alternative you host yourself", and the first thing a switcher does is bring their notes.
A foreign file cannot be restored: nobody wants their own Notes wiped to make room for their Keep archive.
So a second, additive code path was about to appear beside the destructive one, with two buttons in Settings whose difference a user would have to understand before pressing either.

## Decision

**There is one operation, Import, and it is additive for every Source.
Replace-all Restore is removed.**

- A Note in the file that the app has never seen is added.
- A Note the app already holds - same id - is overwritten by the file's version, unconditionally, whichever is newer.
  The user picked the file on purpose; "file wins" is the rule they can predict.
- Only the app's own Backup carries ids the app can recognise.
  Notes from any other Source are always new, so importing the same foreign file twice yields two copies.
  No foreign id is remembered.
- Tags are matched to existing Tags by case-insensitive name and created when missing.
- Nothing is ever emptied.
  A Note created after the Backup survives; a Note trashed after the Backup comes back.

The Source is detected from the zip's contents, never asked: `manifest.json` at the root is a Backup, `Takeout/Keep/*.json` is Google Keep, a tree of `.md` files is an Obsidian vault.
One button, one file input.

## Consequences

- The "put this device back to exactly what the Backup held" use case is gone.
  What comes back instead is reachable: a resurrected Note sits in Trash or the Feed and can be discarded again.
  Accepted, because it removes the only destructive button in the app and the only way a user could lose everything by clicking.
- Upsert-by-id is the same shape as M5's sync conflict rule ([ADR 0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md)), so the user learns one model: a Note has an identity, and the newest thing you deliberately do to that identity wins.
- `restoreBackup` and its "save my current data first" confirm survive in spirit: the pre-import Backup offer stays, checked by default only when the Source is a Backup (the one Source that can overwrite).
- Dedup-aware re-import of a foreign Source (skip notes already imported) would need a stored foreign id on Note and a sync story for it.
  Deferred until someone asks.

## Alternatives considered

- **Keep Restore, add Import beside it.** Two paths, two buttons, one of them destructive. Rejected for the reason above.
- **Upsert only if the file's `updatedAt` is newer.** Safer on paper, unpredictable in practice: the user cannot see which Notes the import touched and which it silently skipped.
- **Store the foreign id and dedup on re-import.** Useful, but a schema change and a sync question for a second-run scenario nobody has yet.
