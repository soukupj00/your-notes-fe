# Use cases

Actors and use cases as the product defines them ([`PRODUCT.md`](../../PRODUCT.md)), split into what ships today (through M4) and what M5 adds.
Capitalized terms are canonical in [`CONTEXT.md`](../../CONTEXT.md).

## Actors

- **User** - the person taking notes on a Device. Both product audiences (the self-hoster and the household member they hand the app to) act as this actor in the daily surface; the distinction only matters for server administration.
- **Owner** (M5) - the first Local Account on a Self-hosted Server; the only one that can issue Invites and reset another member's password. A server role, not a kind of Note.
- **Invited member** (M5) - a person spending an Invite to create their own Local Account. Accounts are private silos; sharing a server never shares Notes.
- **The app itself** - a genuine actor in two places: the Tour (it creates and purges Props) and the sweeps (orphan Attachment GC, trash purge).
- **The sync engine** (M5) - acts on the user's behalf when connectivity returns; never makes a content decision (a Conflict is resolved by a person).

## Current use cases (through M4)

### Capture and edit

| Use case | Notes |
|---|---|
| Create a note | From the desktop "Take a note" bar or the mobile quick-capture speed dial; five Starts: note, checklist, photo, audio, drawing. Media Starts carry a capture intent the Editor auto-runs on open. |
| Edit rich text | TipTap Body: marks, headings, lists, blockquote, text/highlight color, fonts, alignment, links, code, math (KaTeX); slash menu; `mod+K`. |
| Keep a Checklist | A task list *inside* the Body; checked items sink in presentation only ([ADR 0013](../adr/0013-checklist-sinking-is-presentation-not-storage.md)). |
| Attach media | Image, audio (with in-app recording), video, arbitrary file, Excalidraw Drawing; via toolbar, paste, or drop; delete is always confirm-guarded. |
| Autosave | Debounced; the "Saved" indicator means *saved locally* (a meaning kept distinct from sync state by design). |

### Organize

| Use case | Notes |
|---|---|
| Label a note | Attach/detach Tags via `NoteTagsBar`; Tags are created on the fly and exist independently of Notes. |
| Color a note / a label | A palette token, resolved per Theme and Vision Mode. |
| Pin | Surfaces the Note at the top of the Active Feed; cleared by archive/trash. |
| Archive | Keeping without clutter: hidden from the main Feed, never auto-deleted, still searchable. |
| Trash and restore | Discarding with an undo window; a 30-day grace period, then the Purge sweep removes it permanently ([ADR 0009](../adr/0009-note-lifecycle-model.md)). |
| Manage labels | `/labels`: rename, recolour, merge-into, delete. |

### Find

| Use case | Notes |
|---|---|
| Search | Fuzzy, ranked (Fuse.js) over header and Body. |
| Sort and filter | Sort by updated/created/title in a direction; AND-combined Tag filters; all of it typed URL state, so a filtered Feed is shareable and refresh-proof. |
| Scan the Feed | Masonry or list wall; Membership is live, Rank is held ([ADR 0012](../adr/0012-feed-rank-is-held-membership-is-live.md)). |

### Own and protect data

| Use case | Notes |
|---|---|
| Back up | Whole database to one `.zip` (manifest + attachment blobs). |
| Restore | Replace-all, validated before any write; the confirm dialog offers "save my current data first" by default. |
| Install as PWA | Prompted install; explicit in-app update flow. |
| Persistent storage | Requested at the first user-saved note. |

### Make it yours

Theme (light/dark/system), Vision Mode (colour-blind palette), density, reduced motion, locale (en/cs), Toolbar Layout per Width Class, quick-capture order and FAB side.
Customisability is a positioning claim ("this one is yours"), which is why it is a use-case family and not a settings appendix.

### Learn the app

The six-step Tour *drives* the real app on disposable Props it creates and purges ([ADR 0015](../adr/0015-the-tour-drives-the-app-on-disposable-props.md)); offered once, replayable from Settings.

## M5 use cases (designed, not built)

| Use case | Actor | Notes |
|---|---|---|
| First-run setup | Self-hoster | One container; first visit to a fresh server creates the Owner, then registration closes. |
| Invite a member | Owner | Issues a one-time Invite; the newcomer spends it to create a Local Account. |
| Sign in (adopt) | User | A never-attached Device uploads its existing Notes into the Account on first sign-in (UUIDs cannot collide). |
| Sync | Sync engine | Bidirectional; push the dirty set, pull the change feed from a stored cursor; on focus/online/visibility + a short interval while visible. |
| Resolve a conflict | User | The app never merges silently: the server's version wins, the loser is kept as a Conflicted Copy under a "Conflicts" Tag; the user reads two Notes and deletes one ([ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md)). |
| Sign out (erase) | User | Clears the local database (the server holds everything); blocked while the Queue is non-empty, offering the zip backup first. |
| Revoke a lost device | User | Server-side sessions, one per Device, revocable from Settings. |
| Reset a password | Owner | No email/SMTP anywhere: the Owner resets a member's password from Settings; the Owner's own is reset with a command against the container. |

Sync is opt-in end to end: every current use case works with no Account, Tour included.

## For the paper

- The actor list is unusual and worth stating: the app and the sync engine are actors with strictly bounded authority (Props and sweeps; transport but never content decisions).
- Good scenario walk-throughs: interrupted one-handed mobile capture (the product's defining context), trash-restore-purge, backup-restore, and the M5 conflict story told from the user's chair.
- The two-audience framing (self-hoster depth on demand, household-member simplicity by default) explains many UI decisions and belongs in the requirements chapter.
